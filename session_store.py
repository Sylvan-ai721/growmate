from copy import deepcopy
from contextlib import closing
import json
import os
from pathlib import Path
import sqlite3
import time
from typing import Any, Dict, Optional
from uuid import uuid4


class SessionStore:
    def __init__(self, path=None):
        self.path = str(path or os.getenv("GROWMATE_SESSION_DB") or Path(__file__).with_name(".growmate-sessions.sqlite3"))
        with closing(sqlite3.connect(self.path)) as connection, connection:
            connection.execute("CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, state TEXT NOT NULL, updated REAL NOT NULL)")

    def create(self, initial_state: Optional[Dict[str, Any]] = None):
        session_id = uuid4().hex
        self.update(session_id, initial_state or {})
        return session_id

    def get(self, session_id: str):
        with closing(sqlite3.connect(self.path)) as connection, connection:
            row = connection.execute("SELECT state FROM sessions WHERE id = ? AND updated > ?", (session_id, time.time() - 7 * 86400)).fetchone()
        return json.loads(row[0]) if row else {}

    def update(self, session_id: str, patch: Dict[str, Any]):
        with closing(sqlite3.connect(self.path, timeout=10)) as connection, connection:
            connection.execute("BEGIN IMMEDIATE")
            cutoff = time.time() - 7 * 86400
            row = connection.execute("SELECT state FROM sessions WHERE id = ? AND updated > ?", (session_id, cutoff)).fetchone()
            current = json.loads(row[0]) if row else {}
            current.update(deepcopy(patch))
            connection.execute("INSERT OR REPLACE INTO sessions VALUES (?, ?, ?)", (session_id, json.dumps(current, ensure_ascii=False), time.time()))
            connection.execute("DELETE FROM sessions WHERE updated <= ?", (cutoff,))
        return current


session_store = SessionStore()
