"""
Notebook store — central entity linking multiple document sources (NotebookLM-style).
"""
import json
import os
import sqlite3
import uuid
from datetime import datetime
from typing import Dict, List, Optional

from utils.logger import db_logger


class NotebookStore:
    def __init__(self, db_path: str = None):
        if db_path is None:
            db_path = os.getenv("NOTEBOOK_DB_PATH", "db/notebooks.db")
        self.db_path = db_path
        os.makedirs(os.path.dirname(db_path) or ".", exist_ok=True)
        self._init_db()
        db_logger.info(f"NotebookStore initialized at {db_path}")

    def _init_db(self):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS notebooks (
                notebook_id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS notebook_sources (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                notebook_id TEXT NOT NULL,
                doc_id TEXT NOT NULL,
                added_at TEXT NOT NULL,
                UNIQUE(notebook_id, doc_id),
                FOREIGN KEY (notebook_id) REFERENCES notebooks(notebook_id) ON DELETE CASCADE
            )
            """
        )
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_sources_notebook ON notebook_sources(notebook_id)"
        )
        conn.commit()
        conn.close()

    def create_notebook(self, title: str, description: str = "") -> Dict:
        notebook_id = str(uuid.uuid4())
        now = datetime.now().isoformat()
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO notebooks (notebook_id, title, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (notebook_id, title, description, now, now),
        )
        conn.commit()
        conn.close()
        db_logger.info(f"Created notebook {notebook_id}: {title}")
        return self.get_notebook(notebook_id)

    def list_notebooks(self) -> List[Dict]:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM notebooks ORDER BY updated_at DESC")
        rows = cursor.fetchall()
        conn.close()
        return [self._enrich_notebook(dict(r)) for r in rows]

    def get_notebook(self, notebook_id: str) -> Optional[Dict]:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM notebooks WHERE notebook_id = ?", (notebook_id,))
        row = cursor.fetchone()
        conn.close()
        if not row:
            return None
        return self._enrich_notebook(dict(row))

    def _enrich_notebook(self, notebook: Dict) -> Dict:
        notebook["sources"] = self.get_sources(notebook["notebook_id"])
        notebook["source_count"] = len(notebook["sources"])
        return notebook

    def update_notebook(self, notebook_id: str, title: str = None, description: str = None) -> Optional[Dict]:
        notebook = self.get_notebook(notebook_id)
        if not notebook:
            return None
        new_title = title if title is not None else notebook["title"]
        new_desc = description if description is not None else notebook["description"]
        now = datetime.now().isoformat()
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE notebooks SET title = ?, description = ?, updated_at = ? WHERE notebook_id = ?",
            (new_title, new_desc, now, notebook_id),
        )
        conn.commit()
        conn.close()
        return self.get_notebook(notebook_id)

    def delete_notebook(self, notebook_id: str) -> bool:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM notebook_sources WHERE notebook_id = ?", (notebook_id,))
        cursor.execute("DELETE FROM notebooks WHERE notebook_id = ?", (notebook_id,))
        deleted = cursor.rowcount > 0
        conn.commit()
        conn.close()
        return deleted

    def add_source(self, notebook_id: str, doc_id: str) -> bool:
        if not self.get_notebook(notebook_id):
            return False
        now = datetime.now().isoformat()
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        try:
            cursor.execute(
                "INSERT INTO notebook_sources (notebook_id, doc_id, added_at) VALUES (?, ?, ?)",
                (notebook_id, doc_id, now),
            )
            cursor.execute(
                "UPDATE notebooks SET updated_at = ? WHERE notebook_id = ?",
                (now, notebook_id),
            )
            conn.commit()
            return True
        except sqlite3.IntegrityError:
            return True
        finally:
            conn.close()

    def remove_source(self, notebook_id: str, doc_id: str) -> bool:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            "DELETE FROM notebook_sources WHERE notebook_id = ? AND doc_id = ?",
            (notebook_id, doc_id),
        )
        conn.commit()
        conn.close()
        return True

    def get_sources(self, notebook_id: str) -> List[str]:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT doc_id FROM notebook_sources WHERE notebook_id = ? ORDER BY added_at",
            (notebook_id,),
        )
        rows = cursor.fetchall()
        conn.close()
        return [r[0] for r in rows]


notebook_store = NotebookStore()
