"""
Wrapper SQLite pour Save & Resurface.
Toutes les opérations de lecture/écriture passent par ce module.
"""

import sqlite3
import json
from pathlib import Path
from typing import Optional

# saves.db est à la racine du projet, un niveau au-dessus de backend/
DB_PATH = Path(__file__).parent.parent / "saves.db"


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # permet d'accéder aux colonnes par nom
    return conn


def init_db() -> None:
    """Crée les tables si elles n'existent pas encore."""
    with _connect() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS saves (
                id                   INTEGER PRIMARY KEY AUTOINCREMENT,
                url                  TEXT    UNIQUE NOT NULL,
                source               TEXT    NOT NULL,
                title                TEXT,
                content_raw          TEXT,
                summary              TEXT,
                tags                 TEXT    DEFAULT '[]',
                relevance_score      INTEGER,
                category             TEXT,
                metadata             TEXT    DEFAULT '{}',
                created_at           TEXT    DEFAULT (datetime('now')),
                last_consulted_at    TEXT,
                claude_tokens_input  INTEGER DEFAULT 0,
                claude_tokens_output INTEGER DEFAULT 0,
                claude_cost_eur      REAL    DEFAULT 0.0,
                model_used           TEXT,
                is_favorite          INTEGER NOT NULL DEFAULT 0,
                is_read              INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS consultations (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                save_id      INTEGER NOT NULL REFERENCES saves(id),
                consulted_at TEXT    DEFAULT (datetime('now')),
                action       TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_saves_source   ON saves(source);
            CREATE INDEX IF NOT EXISTS idx_saves_created  ON saves(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_saves_category ON saves(category);
        """)

    # Migrations idempotentes — ajout des colonnes sur les bases existantes
    _migrate_add_column("category",    "TEXT")
    _migrate_add_column("is_favorite", "INTEGER NOT NULL DEFAULT 0")
    _migrate_add_column("is_read",     "INTEGER NOT NULL DEFAULT 0")


def _migrate_add_column(column: str, definition: str) -> None:
    """Ajoute une colonne si elle n'existe pas — idempotent."""
    with _connect() as conn:
        try:
            conn.execute(f"ALTER TABLE saves ADD COLUMN {column} {definition}")
        except sqlite3.OperationalError:
            pass


def url_exists(url: str) -> Optional[int]:
    """Retourne l'ID du save si l'URL existe déjà en base, sinon None."""
    with _connect() as conn:
        row = conn.execute("SELECT id FROM saves WHERE url = ?", (url,)).fetchone()
        return row["id"] if row else None


def insert_save(
    url: str,
    source: str,
    title: str,
    content_raw: str,
    summary: str,
    tags: list,
    relevance_score: int,
    metadata: dict,
    tokens_input: int,
    tokens_output: int,
    cost_eur: float,
    model_used: str,
    category: Optional[str] = None,
) -> int:
    """Insère un nouveau save et retourne son ID."""
    with _connect() as conn:
        cursor = conn.execute(
            """INSERT INTO saves
               (url, source, title, content_raw, summary, tags, relevance_score,
                metadata, claude_tokens_input, claude_tokens_output, claude_cost_eur,
                model_used, category)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                url,
                source,
                title,
                content_raw,
                summary,
                json.dumps(tags, ensure_ascii=False),
                relevance_score,
                json.dumps(metadata, ensure_ascii=False),
                tokens_input,
                tokens_output,
                cost_eur,
                model_used,
                category,
            ),
        )
        return cursor.lastrowid


def get_save_by_id(save_id: int) -> Optional[dict]:
    """Retourne un save complet (avec content_raw) par son ID."""
    with _connect() as conn:
        row = conn.execute("SELECT * FROM saves WHERE id = ?", (save_id,)).fetchone()
        return _row_to_dict(row) if row else None


def list_saves(
    source: Optional[str] = None,
    tag: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 50,
) -> list[dict]:
    """
    Liste les saves triés par date décroissante.
    Filtres optionnels : source, tag (nom exact), category.
    Pour category="Autre", inclut aussi les saves sans catégorie (NULL).
    """
    query = "SELECT * FROM saves"
    params: list = []
    conditions: list[str] = []

    if source:
        conditions.append("source = ?")
        params.append(source)
    if tag:
        conditions.append("tags LIKE ?")
        params.append(f'%"{tag}"%')
    if category:
        if category == "Autre":
            conditions.append("(category IS NULL OR category = 'Autre')")
        else:
            conditions.append("category = ?")
            params.append(category)

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    query += " ORDER BY created_at DESC LIMIT ?"
    params.append(limit)

    with _connect() as conn:
        rows = conn.execute(query, params).fetchall()
        return [_row_to_dict(r) for r in rows]


def search_saves(q: str) -> list[dict]:
    """Recherche full-text dans titre, contenu brut, synthèse et tags."""
    pattern = f"%{q}%"
    query = """
        SELECT * FROM saves
        WHERE title LIKE ? OR content_raw LIKE ? OR summary LIKE ? OR tags LIKE ?
        ORDER BY created_at DESC
        LIMIT 50
    """
    with _connect() as conn:
        rows = conn.execute(query, (pattern, pattern, pattern, pattern)).fetchall()
        return [_row_to_dict(r) for r in rows]


def get_stats() -> dict:
    """Statistiques globales : total, répartition par source/catégorie, coûts, top tags."""
    with _connect() as conn:
        total = conn.execute("SELECT COUNT(*) as n FROM saves").fetchone()["n"]

        by_source = conn.execute(
            "SELECT source, COUNT(*) as n FROM saves GROUP BY source"
        ).fetchall()

        by_category = conn.execute(
            "SELECT COALESCE(category, 'Autre') as cat, COUNT(*) as n FROM saves GROUP BY cat"
        ).fetchall()

        cost_row = conn.execute(
            """SELECT
                 COALESCE(SUM(claude_cost_eur), 0) as total_cost,
                 COALESCE(SUM(claude_tokens_input + claude_tokens_output), 0) as total_tokens
               FROM saves"""
        ).fetchone()

        by_week = conn.execute(
            """SELECT strftime('%Y-W%W', created_at) as week, COUNT(*) as n
               FROM saves
               WHERE created_at >= date('now', '-84 days')
               GROUP BY week
               ORDER BY week"""
        ).fetchall()

        all_tags_rows = conn.execute(
            "SELECT tags FROM saves WHERE tags != '[]'"
        ).fetchall()
        tag_counts: dict[str, int] = {}
        for row in all_tags_rows:
            for tag in json.loads(row["tags"]):
                tag_counts[tag] = tag_counts.get(tag, 0) + 1
        top_tags = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)[:10]

        unread_count = conn.execute(
            "SELECT COUNT(*) as n FROM saves WHERE is_read = 0"
        ).fetchone()["n"]
        favorites_count = conn.execute(
            "SELECT COUNT(*) as n FROM saves WHERE is_favorite = 1"
        ).fetchone()["n"]
        this_week_count = conn.execute(
            "SELECT COUNT(*) as n FROM saves WHERE created_at >= date('now', '-7 days')"
        ).fetchone()["n"]

        return {
            "total_saves": total,
            "unread_count": unread_count,
            "favorites_count": favorites_count,
            "this_week_count": this_week_count,
            "by_source": {row["source"]: row["n"] for row in by_source},
            "by_category": {row["cat"]: row["n"] for row in by_category},
            "claude_cost_eur_total": round(cost_row["total_cost"], 4),
            "claude_tokens_total": cost_row["total_tokens"],
            "top_tags": [{"tag": t, "count": c} for t, c in top_tags],
            "by_week": [{"week": row["week"], "count": row["n"]} for row in by_week],
        }


def touch_consulted(save_id: int) -> None:
    """Met à jour last_consulted_at sans log — appelé à chaque ouverture de save."""
    with _connect() as conn:
        conn.execute(
            "UPDATE saves SET last_consulted_at = datetime('now') WHERE id = ?",
            (save_id,),
        )


def set_favorite(save_id: int, value: bool) -> None:
    """Bascule l'état favori d'un save."""
    with _connect() as conn:
        conn.execute(
            "UPDATE saves SET is_favorite = ? WHERE id = ?",
            (int(value), save_id),
        )


def set_read(save_id: int, value: bool) -> None:
    """Marque un save comme lu ou non lu."""
    with _connect() as conn:
        conn.execute(
            "UPDATE saves SET is_read = ? WHERE id = ?",
            (int(value), save_id),
        )


def record_consultation(save_id: int, action: str) -> None:
    """Enregistre une consultation et met à jour last_consulted_at."""
    with _connect() as conn:
        conn.execute(
            "INSERT INTO consultations (save_id, action) VALUES (?, ?)",
            (save_id, action),
        )
        conn.execute(
            "UPDATE saves SET last_consulted_at = datetime('now') WHERE id = ?",
            (save_id,),
        )


def _row_to_dict(row: sqlite3.Row) -> dict:
    """Convertit une Row SQLite en dict Python avec désérialisation JSON."""
    d = dict(row)
    if d.get("tags"):
        d["tags"] = json.loads(d["tags"])
    if d.get("metadata"):
        d["metadata"] = json.loads(d["metadata"])
    # Entiers SQLite → booléens Python (sérialisés en true/false dans JSON)
    d["is_favorite"] = bool(d.get("is_favorite", 0))
    d["is_read"]     = bool(d.get("is_read", 0))
    return d
