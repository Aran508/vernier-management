"""Configuration and policy for ARAN.

Everything tunable lives here. Edit `aran.toml` next to the package rather
than this file -- values here are defaults.
"""
from __future__ import annotations

import os
import tomllib
from dataclasses import dataclass, field
from pathlib import Path

HOME = Path(os.environ.get("ARAN_HOME", Path.home() / ".aran"))
DB_PATH = HOME / "aran.db"

# --- models -----------------------------------------------------------------
# Cloud: reasoning that is allowed to leave the machine.
CLOUD_REASONING = "claude-opus-5"
CLOUD_ROUTINE = "claude-haiku-4-5"

# Local: everything confidential, plus routing and redaction. The doctor
# command picks the right tag for this machine and writes it to aran.toml.
LOCAL_DEFAULT = "qwen3:4b"
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434")

# Effort per route. Reasoning depth is the main cost lever after caching.
EFFORT = {
    "brief": "low",       # morning brief, summaries, triage
    "chat": "medium",     # ordinary conversation
    "reason": "high",     # design questions, analysis
    "hard": "xhigh",      # CAE interpretation, multi-step tool work
}


@dataclass
class Policy:
    """What is allowed to leave this machine."""

    # Any project listed here is local-only, always. No exceptions, no redaction
    # shortcut -- if no local model is available the request fails closed.
    confidential_projects: list[str] = field(default_factory=list)

    # Directories whose contents are treated as confidential regardless of project.
    confidential_paths: list[str] = field(default_factory=lambda: [])

    # Words that mark a request confidential wherever they appear. Put your
    # employer, customer and programme names here.
    confidential_terms: list[str] = field(default_factory=list)

    # File extensions that are confidential on sight (CAD and CAE artefacts).
    confidential_suffixes: list[str] = field(
        default_factory=lambda: [
            ".catpart", ".catproduct", ".catdrawing", ".cgr",
            ".prt", ".asm", ".sldprt", ".sldasm", ".ipt", ".iam",
            ".inp", ".frd", ".dat", ".odb",
        ]
    )

    # When true, a confidential request with no local model raises instead of
    # silently falling back to the cloud. Leave this on.
    fail_closed: bool = True


@dataclass
class Config:
    local_model: str = LOCAL_DEFAULT
    cloud_enabled: bool = True
    policy: Policy = field(default_factory=Policy)

    @classmethod
    def load(cls, path: Path | None = None) -> "Config":
        path = path or (HOME / "aran.toml")
        if not path.exists():
            return cls()
        raw = tomllib.loads(path.read_text(encoding="utf-8"))
        pol = Policy(**raw.get("policy", {}))
        return cls(
            local_model=raw.get("local_model", LOCAL_DEFAULT),
            cloud_enabled=raw.get("cloud_enabled", True),
            policy=pol,
        )


def ensure_home() -> Path:
    HOME.mkdir(parents=True, exist_ok=True)
    return HOME
