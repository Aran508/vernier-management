"""Two brains, one router.

    LocalBrain   Ollama on this machine. Free, private, slower. Handles every
                 confidential request, plus routing and redaction.
    CloudBrain   Claude Opus 5. The reasoning ceiling. Never sees anything the
                 gate marked local-only.

The router decides which one answers, and at what effort. Getting that split
right is the whole cost model: most turns do not need the expensive path.
"""
from __future__ import annotations

import json
import urllib.error
import urllib.request
from dataclasses import dataclass

from . import config
from .privacy import Level, Verdict


class NoLocalModel(RuntimeError):
    """Raised when a confidential request has nowhere private to run."""


@dataclass
class Answer:
    text: str
    route: str            # "local" | "cloud"
    model: str
    effort: str | None = None
    input_tokens: int = 0
    output_tokens: int = 0
    cached_tokens: int = 0
    refused: bool = False

    @property
    def cache_hit(self) -> bool:
        return self.cached_tokens > 0


# --------------------------------------------------------------------------
# local
# --------------------------------------------------------------------------
class LocalBrain:
    def __init__(self, model: str, host: str = config.OLLAMA_HOST):
        self.model = model
        self.host = host.rstrip("/")

    def available(self) -> bool:
        try:
            with urllib.request.urlopen(f"{self.host}/api/tags", timeout=3) as r:
                tags = json.load(r).get("models", [])
            return any(m.get("name", "").startswith(self.model.split(":")[0]) for m in tags)
        except (urllib.error.URLError, OSError, ValueError):
            return False

    def ask(self, system: str, messages: list[dict], num_predict: int = 2048) -> Answer:
        payload = {
            "model": self.model,
            "messages": [{"role": "system", "content": system}, *messages],
            "stream": False,
            "options": {"num_predict": num_predict, "temperature": 0.3},
        }
        req = urllib.request.Request(
            f"{self.host}/api/chat",
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=600) as r:
            data = json.load(r)
        return Answer(
            text=data["message"]["content"],
            route="local",
            model=self.model,
            input_tokens=data.get("prompt_eval_count", 0),
            output_tokens=data.get("eval_count", 0),
        )


# --------------------------------------------------------------------------
# cloud
# --------------------------------------------------------------------------
class CloudBrain:
    """Claude Opus 5 with adaptive thinking, per-route effort, and caching.

    The system prompt carries your identity, facts and procedures -- large and
    near-constant between turns. It gets a cache breakpoint so you stop paying
    full price for it on every call. Everything volatile (the question, the
    timestamp) goes after it, in `messages`, or the cache silently misses.
    """

    def __init__(self, model: str = config.CLOUD_REASONING):
        self.model = model
        self._client = None

    @property
    def client(self):
        if self._client is None:
            import anthropic  # imported lazily so `aran doctor` works without it
            self._client = anthropic.Anthropic()
        return self._client

    def ask(self, system: str, messages: list[dict], effort: str = "medium",
            max_tokens: int = 16000) -> Answer:
        system_blocks = [{
            "type": "text",
            "text": system,
            "cache_control": {"type": "ephemeral"},   # <- the cache breakpoint
        }]
        kwargs = dict(
            model=self.model,
            max_tokens=max_tokens,
            system=system_blocks,
            messages=messages,
            thinking={"type": "adaptive"},
            output_config={"effort": effort},
        )
        try:
            with self.client.beta.messages.stream(
                betas=["server-side-fallback-2026-07-01"],
                fallbacks="default",
                **kwargs,
            ) as stream:
                msg = stream.get_final_message()
        except Exception:
            # Fallback beta not enabled on this account -- run without it.
            with self.client.messages.stream(**kwargs) as stream:
                msg = stream.get_final_message()

        if getattr(msg, "stop_reason", None) == "refusal":
            return Answer("", "cloud", self.model, effort, refused=True)

        text = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
        u = msg.usage
        return Answer(
            text=text,
            route="cloud",
            model=self.model,
            effort=effort,
            input_tokens=u.input_tokens,
            output_tokens=u.output_tokens,
            cached_tokens=getattr(u, "cache_read_input_tokens", 0) or 0,
        )


# --------------------------------------------------------------------------
# router
# --------------------------------------------------------------------------
# Cheap keyword signals for how hard a turn is. The local model can replace
# this with a real classification once one is loaded, but keywords cost nothing
# and are right most of the time.
HARD = ("why", "design", "analyse", "analyze", "compare", "trade-off", "tradeoff",
        "root cause", "simulate", "stress", "optimise", "optimize", "should i", "debug")
TRIVIAL = ("what time", "remind", "list", "show", "open", "status", "hello", "hi ")


class Router:
    def __init__(self, cfg: config.Config):
        self.cfg = cfg
        self.local = LocalBrain(cfg.local_model)
        self.cloud = CloudBrain() if cfg.cloud_enabled else None

    def effort_for(self, text: str) -> str:
        low = text.lower()
        if any(k in low for k in TRIVIAL):
            return config.EFFORT["brief"]
        if any(k in low for k in HARD):
            return config.EFFORT["reason"]
        return config.EFFORT["chat"]

    def ask(self, system: str, messages: list[dict], verdict: Verdict) -> Answer:
        text = messages[-1]["content"] if messages else ""

        if verdict.level is Level.LOCAL_ONLY:
            if not self.local.available():
                if self.cfg.policy.fail_closed:
                    raise NoLocalModel(
                        "This request is confidential ("
                        + "; ".join(verdict.reasons)
                        + f") and no local model is loaded. Run `ollama pull "
                        f"{self.cfg.local_model}`, or run `aran doctor` to see "
                        "what this machine can host."
                    )
            return self.local.ask(system, messages)

        if self.cloud is None or not self.cfg.cloud_enabled:
            return self.local.ask(system, messages)

        if verdict.level is Level.REDACTED and verdict.redacted_text:
            messages = [*messages[:-1], {**messages[-1], "content": verdict.redacted_text}]

        return self.cloud.ask(system, messages, effort=self.effort_for(text))
