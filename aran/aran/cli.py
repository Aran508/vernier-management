"""ARAN command line.

    aran doctor              what this machine can run, and what to buy first
    aran chat                talk to it
    aran eval [-n 5]         run the eval set N times per task, score it
    aran learn [-n 5]        run the eval set, then distil failures into lessons
    aran lessons             what it has learned from being wrong
    aran remember k=v        teach it a fact
    aran stats               memory sizes
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from . import config, doctor
from .agent import Aran
from .brain import NoLocalModel
from .learn import Harness, load_tasks
from .memory import Memory

EVALS = Path(__file__).resolve().parent.parent / "evals" / "seed.jsonl"


def cmd_chat(args: argparse.Namespace) -> int:
    aran = Aran()
    print(f"ARAN ready. session {aran.session}. Ctrl-D to leave.")
    print(f"local model: {aran.cfg.local_model} "
          f"({'loaded' if aran.router.local.available() else 'not loaded'})\n")
    while True:
        try:
            text = input("you > ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return 0
        if not text:
            continue
        if text in {"/quit", "/exit"}:
            return 0
        if text.startswith("/route "):
            print(f"      {aran.explain_route(text[7:])}\n")
            continue
        if text == "/good":
            aran.confirm_helped()
            print("      noted -- credited the lessons that were in context\n")
            continue
        try:
            ans = aran.turn(text, project=args.project)
        except NoLocalModel as exc:
            print(f"\n[blocked] {exc}\n")
            continue
        if ans.refused:
            print("\n[the model declined this request]\n")
            continue
        meta = f"{ans.route}/{ans.model}"
        if ans.effort:
            meta += f" effort={ans.effort}"
        if ans.cache_hit:
            meta += f" cached={ans.cached_tokens}"
        print(f"\naran> {ans.text}\n      [{meta}  in={ans.input_tokens} out={ans.output_tokens}]\n")


def cmd_eval(args: argparse.Namespace) -> int:
    path = Path(args.tasks) if args.tasks else EVALS
    if not path.exists():
        print(f"no eval file at {path}", file=sys.stderr)
        return 1
    tasks = load_tasks(path)
    aran = Aran()
    h = Harness(aran.ask, aran.memory)
    print(f"running {len(tasks)} tasks x {args.runs} runs\n")
    report = h.run(tasks, runs=args.runs, progress=print)
    print("\n" + report.render())
    if args.learn:
        ids = h.learn_from(report, tasks)
        print(f"\ndistilled {len(ids)} lesson(s) from what failed")
        print("re-run `aran eval` to see whether they helped -- that number is "
              "the only thing that tells you the loop is working.")
    return 0


def cmd_lessons(args: argparse.Namespace) -> int:
    m = Memory()
    rows = m.db.execute(
        "SELECT trigger, mistake, correction, retrieved, helped FROM lessons "
        "WHERE active=1 ORDER BY helped DESC, retrieved DESC"
    ).fetchall()
    if not rows:
        print("no lessons yet. run `aran learn` to build some from failures.")
        return 0
    for r in rows:
        rate = f"{r['helped']}/{r['retrieved']}" if r["retrieved"] else "unused"
        print(f"[{rate:>7}]  when {r['trigger']}")
        print(f"           do: {r['correction']}")
        print(f"           was: {r['mistake']}\n")
    return 0


def cmd_remember(args: argparse.Namespace) -> int:
    m = Memory()
    for pair in args.pairs:
        if "=" not in pair:
            print(f"skipping {pair!r} -- expected subject=value", file=sys.stderr)
            continue
        subject, value = pair.split("=", 1)
        m.set_fact(subject.strip(), value.strip())
        print(f"remembered  {subject.strip()}: {value.strip()}")
    return 0


def cmd_stats(_: argparse.Namespace) -> int:
    for k, v in Memory().stats().items():
        print(f"  {k:18} {v}")
    print(f"\n  db  {config.DB_PATH}")
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="aran", description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("doctor").set_defaults(fn=lambda a: (doctor.report(), 0)[1])

    c = sub.add_parser("chat")
    c.add_argument("--project", help="tag this session's turns with a project name")
    c.set_defaults(fn=cmd_chat)

    e = sub.add_parser("eval")
    e.add_argument("-n", "--runs", type=int, default=5,
                   help="runs per task -- more runs, tighter estimate (default 5)")
    e.add_argument("--tasks", help="path to a .jsonl eval file")
    e.add_argument("--learn", action="store_true", help="distil failures into lessons")
    e.set_defaults(fn=cmd_eval)

    l = sub.add_parser("learn")
    l.add_argument("-n", "--runs", type=int, default=5)
    l.add_argument("--tasks")
    l.set_defaults(fn=cmd_eval, learn=True)

    sub.add_parser("lessons").set_defaults(fn=cmd_lessons)
    sub.add_parser("stats").set_defaults(fn=cmd_stats)

    r = sub.add_parser("remember")
    r.add_argument("pairs", nargs="+", metavar="subject=value")
    r.set_defaults(fn=cmd_remember)

    args = p.parse_args(argv)
    if not hasattr(args, "learn"):
        args.learn = False
    return args.fn(args)


if __name__ == "__main__":
    raise SystemExit(main())
