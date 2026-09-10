# ARAN

A personal engineering assistant for one person. It remembers, it routes work
between a local model and the cloud based on what is confidential, and it gets
measurably more reliable over time by learning from its own failures.

Phase 0 of the [workshop blueprint](../docs/blueprint.html). Costs nothing to
run beyond API tokens, and needs no hardware you do not already own.

## What it is, honestly

ARAN does not train a model and does not make one smarter. Weights never change.
What it does is close the gap between what a model *can* do and what it
*reliably* does on your work -- which in practice is the larger gap.

Three mechanisms do that:

| Mechanism | What it gives you |
|---|---|
| **Four memory stores** | Episodic, semantic, procedural, and lessons. The procedural store is what makes it match *your* 3P sheet format instead of a generic one. |
| **The lesson loop** | Every eval failure is distilled into a trigger/mistake/correction triple and retrieved before similar work. Lessons that never help are pruned. |
| **Best-of-N + evals** | Run each task N times to measure a real pass rate; generate N candidates and keep one that passes a verifier on anything checkable. |

Running a task a thousand times does not raise the model's intelligence. It
finds the failures, and the failures become lessons. That is the compounding
part, and it is real.

## Confidentiality

Your employer's CAD and process data never reaches the cloud. The gate
classifies every request before routing:

- **local only** -- matches a confidential project, term, path or CAD/CAE file
  extension. Runs on the local model or **fails**; it never silently falls back.
- **redacted** -- part numbers, file paths and dimensioned tolerances are
  replaced with stable placeholders before the request leaves the machine.
- **open** -- goes to Claude at an effort level matched to the question.

Set `confidential_terms` in `~/.aran/aran.toml` to your employer, customer and
programme names. Over-list rather than under-list: a false positive costs you a
slower answer, a false negative uploads a drawing.

## Setup (Windows)

```powershell
py -3.11 -m venv .venv
.venv\Scripts\activate
pip install -e .
setx ANTHROPIC_API_KEY "sk-ant-..."

aran doctor          # what this machine can run, and what to buy first
```

`aran doctor` reads your RAM, CPU and GPU and names the exact local model to
pull. Then:

```powershell
ollama pull <the tag doctor printed>
aran chat
```

## Commands

```
aran doctor                    hardware -> model recommendation -> spend priority
aran chat [--project NAME]     talk to it   (/route <text> shows routing, /good credits lessons)
aran eval  -n 5                run the eval set 5x per task, score it
aran learn -n 5                same, then distil every failure into a lesson
aran lessons                   what it has learned, with helped/retrieved ratios
aran remember subject=value    teach it a fact
aran stats                     memory sizes
```

The loop that matters: `aran learn` → `aran eval` → compare the score. If the
second number is not higher, the lessons did not help and you have learned
something more useful than a higher score.

## Why RAM is the whole hardware question

A Mixture-of-Experts model activates a fraction of its parameters per token.
Qwen3-30B-A3B has 30B parameters but ~3B active: it costs a 30B model's
*memory* and a 3B model's *compute*. Quantised to Q4 it wants roughly 19 GB of
RAM and runs usably on a plain CPU, reasoning far above any dense model that
fits the same space.

That is why `aran doctor` puts RAM at the top of the spend list. With ~24 GB
free for a model, confidential work runs properly on your own machine with no
GPU at all. Below that, the local path can only do routing and redaction, and
anything confidential and hard has nowhere to go.

## Layout

```
aran/
├─ config.py    settings and the confidentiality policy
├─ doctor.py    hardware probe -> model tier -> what to buy first
├─ memory.py    four stores, SQLite FTS5 + BM25, no dependencies
├─ privacy.py   the gate: classify, redact, fail closed
├─ brain.py     LocalBrain (Ollama) + CloudBrain (Claude) + Router
├─ learn.py     verifiers, eval harness, lesson distillation, best-of-N
├─ agent.py     the turn loop and the cached prompt prefix
└─ cli.py       entry points
```

## Cost

The system prompt carries identity, facts, procedures and lessons -- large and
near-constant -- so it sits behind a cache breakpoint. Only the question is
volatile. Check `cache_read_input_tokens` in the chat footer: if it stays zero,
something in the prefix is changing every turn and you are paying full price
for it.

Effort is set per route: `low` for briefs and lists, `medium` for chat, `high`
for design and analysis. Same model, very different spend.
