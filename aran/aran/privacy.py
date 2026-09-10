"""The confidentiality gate.

Your CATIA models, 3P sheets and plant figures belong to your employer. This
module decides, before any request is routed, whether it is allowed to leave
the machine -- and when the answer is no, it fails closed rather than quietly
falling back to the cloud.

Two levels:

    LOCAL_ONLY   never leaves the machine. If no local model is loaded the
                 request fails. This is the point of `fail_closed`.
    REDACTED     may go to the cloud with identifiers stripped, but only when
                 you have explicitly allowed it for that turn.

Detection is deliberately over-eager. A false positive costs you a slower
answer from the local model. A false negative uploads your employer's drawing.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum

from .config import Policy


class Level(str, Enum):
    OPEN = "open"
    REDACTED = "redacted"
    LOCAL_ONLY = "local_only"


# Drawing / part numbers: 2+ letters, a separator, then 4+ digits, optionally
# a revision suffix. Catches PN-45231, ABC_100234-A, VM.900871 and similar.
PART_NUMBER = re.compile(r"\b[A-Z]{2,6}[-_. ]?\d{4,10}(?:[-_][A-Z0-9]{1,3})?\b")

# Windows and UNC paths -- a path into a work share is itself a disclosure.
WIN_PATH = re.compile(r"\b(?:[A-Za-z]:\\|\\\\)[^\s\"'<>|]+")

# Tolerances and dimensions with an explicit +/- band. These are the numbers
# that actually matter in a drawing.
TOLERANCE = re.compile(r"\b\d+(?:\.\d+)?\s*(?:\+/-|±)\s*\d+(?:\.\d+)?\s*(?:mm|micron|um|µm)?\b")


@dataclass
class Verdict:
    level: Level
    reasons: list[str] = field(default_factory=list)
    redacted_text: str | None = None

    @property
    def may_use_cloud(self) -> bool:
        return self.level is not Level.LOCAL_ONLY


class Gate:
    def __init__(self, policy: Policy):
        self.policy = policy

    def classify(self, text: str, project: str | None = None) -> Verdict:
        reasons: list[str] = []
        lower = text.lower()

        if project and project.lower() in {p.lower() for p in self.policy.confidential_projects}:
            reasons.append(f"project '{project}' is marked confidential")

        for term in self.policy.confidential_terms:
            if term and term.lower() in lower:
                reasons.append(f"contains confidential term '{term}'")

        for suffix in self.policy.confidential_suffixes:
            if suffix.lower() in lower:
                reasons.append(f"references a {suffix} file")

        for path in self.policy.confidential_paths:
            if path and path.lower() in lower:
                reasons.append(f"references confidential path '{path}'")

        if reasons:
            return Verdict(Level.LOCAL_ONLY, reasons)

        # Weaker signals: identifiers that look proprietary but are not covered
        # by an explicit policy rule. Redact rather than block.
        weak: list[str] = []
        if PART_NUMBER.search(text):
            weak.append("contains part-number-like identifiers")
        if WIN_PATH.search(text):
            weak.append("contains local file paths")
        if TOLERANCE.search(text):
            weak.append("contains dimensioned tolerances")

        if weak:
            return Verdict(Level.REDACTED, weak, self.redact(text))
        return Verdict(Level.OPEN, [])

    @staticmethod
    def redact(text: str) -> str:
        """Replace identifiers with stable placeholders.

        Stable matters: the same part number maps to the same token every time
        within one request, so the model can still reason about 'PART_1 mates
        with PART_2' without ever seeing the real numbers.
        """
        mapping: dict[str, str] = {}

        def sub(pattern: re.Pattern[str], prefix: str, s: str) -> str:
            def repl(m: re.Match[str]) -> str:
                key = m.group(0)
                if key not in mapping:
                    mapping[key] = f"<{prefix}_{len([k for k in mapping.values() if k.startswith('<' + prefix)]) + 1}>"
                return mapping[key]
            return pattern.sub(repl, s)

        out = sub(PART_NUMBER, "PART", text)
        out = sub(WIN_PATH, "PATH", out)
        out = sub(TOLERANCE, "TOL", out)
        return out
