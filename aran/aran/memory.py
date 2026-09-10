"""ARAN's memory: four stores, not one.

    episodes    what happened, appended forever, never rewritten
    facts       durable truths about you and your work, rewritten as they change
    procedures  how *you* do things -- your sheet format, your review order
    lessons     what ARAN got wrong, and the correction, retrieved before it
                makes the same mistake again

The fourth store is the one that compounds. The model's weights never change,
but the context it walks into does, and that is where reliability comes from.

Retrieval is SQLite FTS5 with BM25 -- built in, no dependency, no model
download, instant on a corpus of this size. An embedding path can be layered
on later without touching callers.
"""
from __future__ import annotations

import sqlite3
import time
from dataclasses import dataclass
from pathlib import Path

from . import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS episodes (
    id       INTEGER PRIMARY KEY,
    ts       REAL NOT NULL,
    session  TEXT NOT NULL,
    role     TEXT NOT NULL,
    project  TEXT,
    content  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS facts (
    id         INTEGER PRIMARY KEY,
    subject    TEXT NOT NULL UNIQUE,
    content    TEXT NOT NULL,
    source     TEXT,
    updated_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS procedures (
    id         INTEGER PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE,
    content    TEXT NOT NULL,
    updated_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS lessons (
    id         INTEGER PRIMARY KEY,
    ts         REAL NOT NULL,
    trigger    TEXT NOT NULL,   -- when this lesson applies
    mistake    TEXT NOT NULL,   -- what went wrong
    correction TEXT NOT NULL,   -- what to do instead
    retrieved  INTEGER NOT NULL DEFAULT 0,
    helped     INTEGER NOT NULL DEFAULT 0,
    active     INTEGER NOT NULL DEFAULT 1
);

CREATE VIRTUAL TABLE IF NOT EXISTS episodes_fts USING fts5(
    content, content='episodes', content_rowid='id');
CREATE VIRTUAL TABLE IF NOT EXISTS facts_fts USING fts5(
    subject, content, content='facts', content_rowid='id');
CREATE VIRTUAL TABLE IF NOT EXISTS procedures_fts USING fts5(
    name, content, content='procedures', content_rowid='id');
CREATE VIRTUAL TABLE IF NOT EXISTS lessons_fts USING fts5(
    trigger, mistake, correction, content='lessons', content_rowid='id');
"""

TRIGGERS = """
CREATE TRIGGER IF NOT EXISTS episodes_ai AFTER INSERT ON episodes BEGIN
  INSERT INTO episodes_fts(rowid, content) VALUES (new.id, new.content); END;
CREATE TRIGGER IF NOT EXISTS facts_ai AFTER INSERT ON facts BEGIN
  INSERT INTO facts_fts(rowid, subject, content) VALUES (new.id, new.subject, new.content); END;
CREATE TRIGGER IF NOT EXISTS facts_au AFTER UPDATE ON facts BEGIN
  INSERT INTO facts_fts(facts_fts, rowid, subject, content)
    VALUES ('delete', old.id, old.subject, old.content);
  INSERT INTO facts_fts(rowid, subject, content) VALUES (new.id, new.subject, new.content); END;
CREATE TRIGGER IF NOT EXISTS procedures_ai AFTER INSERT ON procedures BEGIN
  INSERT INTO procedures_fts(rowid, name, content) VALUES (new.id, new.name, new.content); END;
CREATE TRIGGER IF NOT EXISTS procedures_au AFTER UPDATE ON procedures BEGIN
  INSERT INTO procedures_fts(procedures_fts, rowid, name, content)
    VALUES ('delete', old.id, old.name, old.content);
  INSERT INTO procedures_fts(rowid, name, content) VALUES (new.id, new.name, new.content); END;
CREATE TRIGGER IF NOT EXISTS lessons_ai AFTER INSERT ON lessons BEGIN
  INSERT INTO lessons_fts(rowid, trigger, mistake, correction)
    VALUES (new.id, new.trigger, new.mistake, new.correction); END;
"""


@dataclass
class Lesson:
    id: int
    trigger: str
    mistake: str
    correction: str
    retrieved: int
    helped: int

    def as_prompt(self) -> str:
        return f"- When {self.trigger}: {self.correction}  (past error: {self.mistake})"


def _fts_query(text: str) -> str:
    """Turn free text into a safe FTS5 OR-query. FTS5 syntax chars would
    otherwise raise on ordinary punctuation, so keep alphanumerics only."""
    toks = [t for t in "".join(c if c.isalnum() else " " for c in text).split() if len(t) > 2]
    return " OR ".join(f'"{t}"' for t in toks[:32])


class Memory:
    def __init__(self, path: Path | None = None):
        config.ensure_home()
        self.db = sqlite3.connect(path or config.DB_PATH)
        self.db.row_factory = sqlite3.Row
        self.db.executescript(SCHEMA)
        self.db.executescript(TRIGGERS)
        self.db.commit()

    # --- episodic ----------------------------------------------------------
    def add_episode(self, session: str, role: str, content: str, project: str | None = None) -> None:
        self.db.execute(
            "INSERT INTO episodes (ts, session, role, project, content) VALUES (?,?,?,?,?)",
            (time.time(), session, role, project, content),
        )
        self.db.commit()

    def recent(self, session: str, limit: int = 20) -> list[sqlite3.Row]:
        rows = self.db.execute(
            "SELECT role, content FROM episodes WHERE session=? ORDER BY id DESC LIMIT ?",
            (session, limit),
        ).fetchall()
        return list(reversed(rows))

    def recall(self, text: str, limit: int = 5) -> list[str]:
        q = _fts_query(text)
        if not q:
            return []
        rows = self.db.execute(
            "SELECT e.content FROM episodes_fts f JOIN episodes e ON e.id=f.rowid "
            "WHERE episodes_fts MATCH ? ORDER BY bm25(episodes_fts) LIMIT ?",
            (q, limit),
        ).fetchall()
        return [r["content"] for r in rows]

    # --- semantic ----------------------------------------------------------
    def set_fact(self, subject: str, content: str, source: str = "conversation") -> None:
        self.db.execute(
            "INSERT INTO facts (subject, content, source, updated_at) VALUES (?,?,?,?) "
            "ON CONFLICT(subject) DO UPDATE SET content=excluded.content, "
            "source=excluded.source, updated_at=excluded.updated_at",
            (subject, content, source, time.time()),
        )
        self.db.commit()

    def facts_about(self, text: str, limit: int = 8) -> list[str]:
        q = _fts_query(text)
        if not q:
            return []
        rows = self.db.execute(
            "SELECT f.subject, f.content FROM facts_fts x JOIN facts f ON f.id=x.rowid "
            "WHERE facts_fts MATCH ? ORDER BY bm25(facts_fts) LIMIT ?",
            (q, limit),
        ).fetchall()
        return [f"{r['subject']}: {r['content']}" for r in rows]

    # --- procedural --------------------------------------------------------
    def set_procedure(self, name: str, content: str) -> None:
        self.db.execute(
            "INSERT INTO procedures (name, content, updated_at) VALUES (?,?,?) "
            "ON CONFLICT(name) DO UPDATE SET content=excluded.content, "
            "updated_at=excluded.updated_at",
            (name, content, time.time()),
        )
        self.db.commit()

    def procedures_for(self, text: str, limit: int = 3) -> list[str]:
        q = _fts_query(text)
        if not q:
            return []
        rows = self.db.execute(
            "SELECT p.name, p.content FROM procedures_fts x JOIN procedures p ON p.id=x.rowid "
            "WHERE procedures_fts MATCH ? ORDER BY bm25(procedures_fts) LIMIT ?",
            (q, limit),
        ).fetchall()
        return [f"### {r['name']}\n{r['content']}" for r in rows]

    # --- lessons -----------------------------------------------------------
    def add_lesson(self, trigger: str, mistake: str, correction: str) -> int:
        cur = self.db.execute(
            "INSERT INTO lessons (ts, trigger, mistake, correction) VALUES (?,?,?,?)",
            (time.time(), trigger, mistake, correction),
        )
        self.db.commit()
        return int(cur.lastrowid)

    def lessons_for(self, text: str, limit: int = 6) -> list[Lesson]:
        q = _fts_query(text)
        if not q:
            return []
        rows = self.db.execute(
            "SELECT l.* FROM lessons_fts x JOIN lessons l ON l.id=x.rowid "
            "WHERE lessons_fts MATCH ? AND l.active=1 "
            "ORDER BY bm25(lessons_fts) LIMIT ?",
            (q, limit),
        ).fetchall()
        out = [Lesson(r["id"], r["trigger"], r["mistake"], r["correction"],
                      r["retrieved"], r["helped"]) for r in rows]
        if out:
            self.db.executemany(
                "UPDATE lessons SET retrieved=retrieved+1 WHERE id=?",
                [(l.id,) for l in out],
            )
            self.db.commit()
        return out

    def mark_helped(self, lesson_ids: list[int]) -> None:
        self.db.executemany(
            "UPDATE lessons SET helped=helped+1 WHERE id=?", [(i,) for i in lesson_ids]
        )
        self.db.commit()

    def prune_lessons(self, min_retrieved: int = 10) -> int:
        """Retire lessons that keep being retrieved but never help. A lesson
        store that only grows becomes noise that crowds out the useful ones."""
        cur = self.db.execute(
            "UPDATE lessons SET active=0 WHERE active=1 AND retrieved>=? AND helped=0",
            (min_retrieved,),
        )
        self.db.commit()
        return cur.rowcount

    def stats(self) -> dict[str, int]:
        one = lambda sql: int(self.db.execute(sql).fetchone()[0])  # noqa: E731
        return {
            "episodes": one("SELECT count(*) FROM episodes"),
            "facts": one("SELECT count(*) FROM facts"),
            "procedures": one("SELECT count(*) FROM procedures"),
            "lessons": one("SELECT count(*) FROM lessons WHERE active=1"),
            "lessons_retired": one("SELECT count(*) FROM lessons WHERE active=0"),
        }
