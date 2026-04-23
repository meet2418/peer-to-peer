import sqlite3
import string
import random
from pathlib import Path
from typing import Any

from sqlalchemy.engine import Engine


def _is_sqlite(engine: Engine) -> bool:
    return engine.url.get_backend_name() == "sqlite"


def _db_path(engine: Engine) -> str:
    return str(Path(engine.url.database or "app.db"))


def _table_columns(cur: sqlite3.Cursor, table: str) -> list[str]:
    rows = cur.execute(f"PRAGMA table_info('{table}')").fetchall()
    return [r[1] for r in rows]


def _table_exists(cur: sqlite3.Cursor, table: str) -> bool:
    row = cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone()
    return bool(row)


def _gen_join_code(existing: set[str]) -> str:
    alphabet = string.ascii_uppercase + string.digits
    while True:
        code = "".join(random.choice(alphabet) for _ in range(6))
        if code not in existing:
            existing.add(code)
            return code


def _ensure_core_tables(cur: sqlite3.Cursor) -> None:
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS classrooms (
            id INTEGER PRIMARY KEY,
            name VARCHAR(150) NOT NULL,
            subject VARCHAR(150) NOT NULL,
            teacher_id INTEGER NOT NULL REFERENCES users(id),
            join_code VARCHAR(16) NOT NULL UNIQUE,
            created_at DATETIME NOT NULL
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS enrollments (
            id INTEGER PRIMARY KEY,
            classroom_id INTEGER NOT NULL REFERENCES classrooms(id),
            student_id INTEGER NOT NULL REFERENCES users(id),
            created_at DATETIME NOT NULL,
            UNIQUE(classroom_id, student_id)
        )
        """
    )


def _migrate_assignments(cur: sqlite3.Cursor) -> None:
    if not _table_exists(cur, "assignments"):
        return

    cols = _table_columns(cur, "assignments")
    if "classroom_id" in cols:
        return

    existing_codes = {r[0] for r in cur.execute("SELECT join_code FROM classrooms").fetchall()}
    teachers = cur.execute(
        "SELECT DISTINCT created_by FROM assignments WHERE created_by IS NOT NULL"
    ).fetchall()
    teacher_to_classroom: dict[int, int] = {}
    for (teacher_id,) in teachers:
        code = _gen_join_code(existing_codes)
        cur.execute(
            "INSERT INTO classrooms(name,subject,teacher_id,join_code,created_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP)",
            ("General Classroom", "General", int(teacher_id), code),
        )
        teacher_to_classroom[int(teacher_id)] = int(cur.lastrowid)

    cur.execute("ALTER TABLE assignments RENAME TO assignments_old")
    cur.execute(
        """
        CREATE TABLE assignments (
            id INTEGER PRIMARY KEY,
            classroom_id INTEGER NOT NULL REFERENCES classrooms(id),
            title VARCHAR(200) NOT NULL,
            description TEXT NOT NULL,
            topic VARCHAR(120) NOT NULL,
            deadline DATETIME NOT NULL,
            created_at DATETIME NOT NULL
        )
        """
    )

    old_rows = cur.execute(
        "SELECT id,title,description,topic,deadline,created_by,created_at FROM assignments_old ORDER BY id"
    ).fetchall()
    for row in old_rows:
        assignment_id, title, description, topic, deadline, created_by, created_at = row
        classroom_id = teacher_to_classroom.get(int(created_by) if created_by is not None else 0)
        if classroom_id is None:
            all_teacher = cur.execute(
                "SELECT id FROM users WHERE role='teacher' ORDER BY id LIMIT 1"
            ).fetchone()
            if all_teacher:
                teacher_id = int(all_teacher[0])
                code = _gen_join_code(existing_codes)
                cur.execute(
                    "INSERT INTO classrooms(name,subject,teacher_id,join_code,created_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP)",
                    ("General Classroom", "General", teacher_id, code),
                )
                classroom_id = int(cur.lastrowid)
                teacher_to_classroom[teacher_id] = classroom_id
            else:
                continue
        cur.execute(
            """
            INSERT INTO assignments(id,classroom_id,title,description,topic,deadline,created_at)
            VALUES(?,?,?,?,?,?,?)
            """,
            (assignment_id, classroom_id, title, description, topic, deadline, created_at),
        )

    cur.execute("DROP TABLE assignments_old")


def _migrate_submissions(cur: sqlite3.Cursor) -> None:
    if not _table_exists(cur, "submissions"):
        return

    cols = _table_columns(cur, "submissions")
    required = {"ai_score", "ai_feedback", "teacher_score", "attempt_number", "is_latest"}
    if required.issubset(set(cols)):
        return

    cur.execute("ALTER TABLE submissions RENAME TO submissions_old")
    cur.execute(
        """
        CREATE TABLE submissions (
            id INTEGER PRIMARY KEY,
            assignment_id INTEGER NOT NULL REFERENCES assignments(id),
            student_id INTEGER NOT NULL REFERENCES users(id),
            attempt_number INTEGER NOT NULL DEFAULT 1,
            file_url VARCHAR(255),
            text_content TEXT,
            ai_score FLOAT,
            ai_feedback TEXT,
            ai_suggestions TEXT,
            teacher_score FLOAT,
            teacher_feedback TEXT,
            created_at DATETIME NOT NULL,
            is_latest BOOLEAN NOT NULL DEFAULT 1
        )
        """
    )

    old_cols = _table_columns(cur, "submissions_old")
    old_rows = cur.execute("SELECT * FROM submissions_old ORDER BY assignment_id, student_id, created_at, id").fetchall()
    col_idx = {name: i for i, name in enumerate(old_cols)}

    def get(row: tuple[Any, ...], name: str, default: Any = None) -> Any:
        idx = col_idx.get(name)
        return row[idx] if idx is not None else default

    per_pair_attempt: dict[tuple[int, int], int] = {}
    latest_id_by_pair: dict[tuple[int, int], int] = {}
    for row in old_rows:
        pair = (int(get(row, "assignment_id", 0)), int(get(row, "student_id", 0)))
        latest_id_by_pair[pair] = int(get(row, "id", 0))

    for row in old_rows:
        assignment_id = int(get(row, "assignment_id", 0))
        student_id = int(get(row, "student_id", 0))
        pair = (assignment_id, student_id)
        per_pair_attempt[pair] = per_pair_attempt.get(pair, 0) + 1
        attempt_number = int(get(row, "attempt_number", per_pair_attempt[pair]))

        score = get(row, "score")
        feedback = get(row, "feedback")
        improvements = get(row, "improvements")

        ai_score = get(row, "ai_score", score)
        ai_feedback = get(row, "ai_feedback", feedback)
        ai_suggestions = get(row, "ai_suggestions", improvements)
        teacher_score = get(row, "teacher_score")
        teacher_feedback = get(row, "teacher_feedback")
        is_latest = int(get(row, "is_latest", 1 if int(get(row, "id", 0)) == latest_id_by_pair[pair] else 0))

        cur.execute(
            """
            INSERT INTO submissions(
                id, assignment_id, student_id, attempt_number, file_url, text_content,
                ai_score, ai_feedback, ai_suggestions, teacher_score, teacher_feedback, created_at, is_latest
            )
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                int(get(row, "id", 0)),
                assignment_id,
                student_id,
                attempt_number,
                get(row, "file_url"),
                get(row, "text_content"),
                ai_score,
                ai_feedback,
                ai_suggestions,
                teacher_score,
                teacher_feedback,
                get(row, "created_at"),
                is_latest,
            ),
        )

    cur.execute("DROP TABLE submissions_old")
    cur.execute("CREATE INDEX IF NOT EXISTS ix_submissions_assignment_id ON submissions (assignment_id)")
    cur.execute("CREATE INDEX IF NOT EXISTS ix_submissions_student_id ON submissions (student_id)")
    cur.execute("CREATE INDEX IF NOT EXISTS ix_submissions_is_latest ON submissions (is_latest)")


def _ensure_peer_reviews_table(cur: sqlite3.Cursor) -> None:
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS peer_reviews (
            id INTEGER PRIMARY KEY,
            submission_id INTEGER NOT NULL REFERENCES submissions(id),
            reviewer_id INTEGER NOT NULL REFERENCES users(id),
            rating INTEGER NOT NULL,
            feedback TEXT,
            created_at DATETIME NOT NULL,
            UNIQUE(submission_id, reviewer_id)
        )
        """
    )
    cur.execute("CREATE INDEX IF NOT EXISTS ix_peer_reviews_submission_id ON peer_reviews (submission_id)")
    cur.execute("CREATE INDEX IF NOT EXISTS ix_peer_reviews_reviewer_id ON peer_reviews (reviewer_id)")


def migrate_database(engine: Engine) -> None:
    if not _is_sqlite(engine):
        return

    db_path = _db_path(engine)
    conn = sqlite3.connect(db_path)
    try:
        cur = conn.cursor()
        cur.execute("PRAGMA foreign_keys=OFF")
        _ensure_core_tables(cur)
        _migrate_assignments(cur)
        _migrate_submissions(cur)
        _ensure_peer_reviews_table(cur)
        cur.execute("PRAGMA foreign_keys=ON")
        conn.commit()
    finally:
        conn.close()
