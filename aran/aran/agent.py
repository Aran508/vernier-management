"""ARAN's turn loop.

One turn:
    classify -> retrieve -> build cached prefix -> route -> answer -> record

The ordering matters for cost. Everything slow-changing (who you are, your
facts, your procedures, the lessons that apply) goes into the system prompt
behind a cache breakpoint. Only the question itself is volatile. Get that
backwards and you pay full input price on every single turn.
"""
from __future__ import annotations

import uuid

from .brain import Answer, Router
from .config import Config
from .memory import Memory
from .privacy import Gate, Level

IDENTITY = """You are ARAN, a personal engineering assistant. You work for one
person and no one else.

How you answer:
- Lead with the answer. Context after, only if it changes what they do.
- When you are uncertain, say so and say what would resolve it. Never fill a
  gap with a confident guess.
- Engineering claims carry their units, their assumptions, and their source.
- If a request is ambiguous in a way that changes the answer, ask. Otherwise
  make the call and state the assumption you made.
- You are not a search engine and not a cheerleader. Short is usually right."""


class Aran:
    def __init__(self, cfg: Config | None = None, memory: Memory | None = None):
        self.cfg = cfg or Config.load()
        self.memory = memory or Memory()
        self.router = Router(self.cfg)
        self.gate = Gate(self.cfg.policy)
        self.session = uuid.uuid4().hex[:12]
        self._last_lessons: list[int] = []

    # -- prompt assembly ----------------------------------------------------
    def build_system(self, question: str) -> str:
        """The cached prefix. Ordered most-stable first so that a change in
        lessons does not invalidate the identity block ahead of it."""
        parts = [IDENTITY]

        facts = self.memory.facts_about(question)
        if facts:
            parts.append("## What you know about them\n" + "\n".join(f"- {f}" for f in facts))

        procs = self.memory.procedures_for(question)
        if procs:
            parts.append("## How they do things\n" + "\n\n".join(procs))

        lessons = self.memory.lessons_for(question)
        self._last_lessons = [l.id for l in lessons]
        if lessons:
            parts.append(
                "## Mistakes you have made before, and the corrections\n"
                "These were derived from your own past failures on this person's "
                "work. Apply them.\n"
                + "\n".join(l.as_prompt() for l in lessons)
            )

        recalled = self.memory.recall(question, limit=3)
        if recalled:
            parts.append(
                "## Possibly relevant, from earlier conversations\n"
                + "\n".join(f"- {r[:280]}" for r in recalled)
            )
        return "\n\n".join(parts)

    # -- one turn -----------------------------------------------------------
    def turn(self, text: str, project: str | None = None) -> Answer:
        verdict = self.gate.classify(text, project)
        system = self.build_system(text)
        history = [
            {"role": r["role"], "content": r["content"]}
            for r in self.memory.recent(self.session, limit=10)
        ]
        messages = [*history, {"role": "user", "content": text}]

        answer = self.router.ask(system, messages, verdict)

        self.memory.add_episode(self.session, "user", text, project)
        if answer.text:
            self.memory.add_episode(self.session, "assistant", answer.text, project)
        return answer

    def ask(self, text: str) -> str:
        """Plain prompt -> plain text. This is what the eval harness drives."""
        return self.turn(text).text

    def confirm_helped(self) -> None:
        """Call when a turn actually landed -- credits the lessons that were in
        context. Lessons that are never credited eventually get pruned."""
        if self._last_lessons:
            self.memory.mark_helped(self._last_lessons)

    def explain_route(self, text: str, project: str | None = None) -> str:
        v = self.gate.classify(text, project)
        if v.level is Level.LOCAL_ONLY:
            return f"local only ({'; '.join(v.reasons)})"
        if v.level is Level.REDACTED:
            return f"cloud, redacted ({'; '.join(v.reasons)})"
        return f"cloud, effort={self.router.effort_for(text)}"
