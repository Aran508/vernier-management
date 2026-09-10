"""The improvement loop.

What running a task a thousand times actually buys you -- and what it doesn't.

It does NOT change the model. Weights are fixed; no amount of local repetition
makes Opus or Qwen smarter. Anyone promising otherwise is selling something.

What it does buy, all of it real and all of it compounding:

  1. MEASUREMENT   Run each task N times and you learn the pass rate, not one
                   lucky sample. You cannot fix what you have not measured, and
                   a single run of a stochastic system measures nothing.

  2. LESSONS       Every failure is distilled into a trigger/mistake/correction
                   triple and stored. Next time a similar task arrives, the
                   lesson is retrieved and put in front of the model. This is
                   the mechanism that makes ARAN yours -- it accumulates the
                   specific ways it has been wrong *for you*.

  3. BEST-OF-N     For anything checkable -- a calculation, a mesh that must
                   converge, code that must run -- generate N candidates and
                   keep one that passes the verifier. Raises accuracy for a
                   linear increase in tokens.

  4. HILLCLIMBING  Change the scaffold, re-run the same eval, keep the change
                   only if the score went up. Held-out tasks stop you tuning
                   into noise.

The result is an assistant that gets measurably more reliable every week
without a single weight being updated.
"""
from __future__ import annotations

import json
import re
import statistics
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from pathlib import Path

from .memory import Memory

Verifier = Callable[[str], bool]


# --------------------------------------------------------------------------
# verifiers
# --------------------------------------------------------------------------
def make_verifier(spec: dict) -> Verifier:
    """Build a checker from an eval-file spec.

    A task without a mechanical verifier cannot be hillclimbed, so keep the
    eval set biased towards things a machine can check.
    """
    kind = spec.get("check", "contains")
    want = spec.get("expect", "")

    if kind == "contains":
        return lambda out: str(want).lower() in out.lower()
    if kind == "not_contains":
        return lambda out: str(want).lower() not in out.lower()
    if kind == "equals":
        return lambda out: out.strip().lower() == str(want).strip().lower()
    if kind == "regex":
        pat = re.compile(str(want), re.I | re.S)
        return lambda out: bool(pat.search(out))
    if kind == "numeric":
        target, tol = float(want), float(spec.get("tolerance", 0.01))
        def _num(out: str) -> bool:
            nums = [float(n) for n in re.findall(r"-?\d+(?:\.\d+)?", out)]
            return any(abs(n - target) <= tol * max(1.0, abs(target)) for n in nums)
        return _num
    if kind == "all_of":
        needles = [str(w).lower() for w in want]
        return lambda out: all(n in out.lower() for n in needles)
    raise ValueError(f"unknown check kind: {kind!r}")


# --------------------------------------------------------------------------
# results
# --------------------------------------------------------------------------
@dataclass
class TaskResult:
    task_id: str
    prompt: str
    runs: int
    passes: int
    outputs: list[str] = field(default_factory=list)

    @property
    def pass_rate(self) -> float:
        return self.passes / self.runs if self.runs else 0.0

    @property
    def flaky(self) -> bool:
        """Sometimes right, sometimes wrong -- the most fixable failure mode.
        A task at 0.0 needs capability; a task at 0.4 needs a lesson."""
        return 0.0 < self.pass_rate < 1.0


@dataclass
class EvalReport:
    results: list[TaskResult]

    @property
    def score(self) -> float:
        return statistics.mean([r.pass_rate for r in self.results]) if self.results else 0.0

    @property
    def solid(self) -> list[TaskResult]:
        return [r for r in self.results if r.pass_rate == 1.0]

    @property
    def flaky(self) -> list[TaskResult]:
        return [r for r in self.results if r.flaky]

    @property
    def broken(self) -> list[TaskResult]:
        return [r for r in self.results if r.pass_rate == 0.0]

    def render(self) -> str:
        lines = [
            f"score {self.score:.1%}   "
            f"solid {len(self.solid)}  flaky {len(self.flaky)}  broken {len(self.broken)}",
            "-" * 66,
        ]
        for r in sorted(self.results, key=lambda x: x.pass_rate):
            bar = "#" * round(r.pass_rate * 10) + "." * (10 - round(r.pass_rate * 10))
            lines.append(f"  [{bar}] {r.pass_rate:5.0%}  {r.task_id:22} ({r.passes}/{r.runs})")
        return "\n".join(lines)


# --------------------------------------------------------------------------
# harness
# --------------------------------------------------------------------------
def load_tasks(path: Path) -> list[dict]:
    return [json.loads(l) for l in path.read_text(encoding="utf-8").splitlines() if l.strip()]


class Harness:
    """Runs an eval set and turns what fails into lessons."""

    def __init__(self, ask: Callable[[str], str], memory: Memory):
        self.ask = ask          # prompt -> answer, already wired to the router
        self.memory = memory

    def run(self, tasks: Iterable[dict], runs: int = 5,
            progress: Callable[[str], None] | None = None) -> EvalReport:
        results: list[TaskResult] = []
        for task in tasks:
            verify = make_verifier(task)
            outputs: list[str] = []
            passes = 0
            for _ in range(runs):
                try:
                    out = self.ask(task["prompt"])
                except Exception as exc:            # a crash is a failure, not an abort
                    out = f"<error: {exc}>"
                outputs.append(out)
                if verify(out):
                    passes += 1
            r = TaskResult(task["id"], task["prompt"], runs, passes, outputs)
            results.append(r)
            if progress:
                progress(f"  {r.task_id:22} {r.pass_rate:5.0%}")
        return EvalReport(results)

    # -- turning failures into memory ---------------------------------------
    DISTILL = (
        "You are reviewing a failed attempt by an assistant.\n"
        "Write ONE reusable lesson as strict JSON with exactly these keys:\n"
        '  "trigger"    - when this lesson applies, a short phrase starting with a verb\n'
        '  "mistake"    - what went wrong, one sentence\n'
        '  "correction" - what to do instead, one imperative sentence\n'
        "Be specific to the recurring error, not to this one input. "
        "Output only the JSON object."
    )

    def distill(self, result: TaskResult, expected: str) -> int | None:
        """Turn a failing task into a stored lesson. Returns the lesson id."""
        worst = min(result.outputs, key=len) if result.outputs else ""
        raw = self.ask(
            f"{self.DISTILL}\n\nTASK: {result.prompt}\n"
            f"EXPECTED: {expected}\nGOT: {worst[:1500]}"
        )
        m = re.search(r"\{.*\}", raw, re.S)
        if not m:
            return None
        try:
            d = json.loads(m.group(0))
            return self.memory.add_lesson(d["trigger"], d["mistake"], d["correction"])
        except (json.JSONDecodeError, KeyError):
            return None

    def learn_from(self, report: EvalReport, tasks: list[dict]) -> list[int]:
        """Distil every non-perfect task into a lesson. Flaky tasks first --
        those are where a lesson has the most leverage."""
        by_id = {t["id"]: t for t in tasks}
        ids: list[int] = []
        for r in sorted(report.flaky + report.broken, key=lambda x: -x.pass_rate):
            spec = by_id.get(r.task_id, {})
            lid = self.distill(r, str(spec.get("expect", "")))
            if lid:
                ids.append(lid)
        return ids


# --------------------------------------------------------------------------
# inference-time reliability
# --------------------------------------------------------------------------
def best_of_n(ask: Callable[[str], str], prompt: str, verify: Verifier,
              n: int = 5) -> tuple[str, int]:
    """Generate up to n candidates, return the first that verifies.

    This is where repetition genuinely raises accuracy -- but only when there
    is a real checker. Without a verifier this is just n times the cost for the
    same expected quality, so never enable it on open-ended chat.
    """
    last = ""
    for attempt in range(1, n + 1):
        last = ask(prompt)
        if verify(last):
            return last, attempt
    return last, n
