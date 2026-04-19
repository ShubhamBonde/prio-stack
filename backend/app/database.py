import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "priority_stack.db"


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            parent_id INTEGER NULL,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            state TEXT NOT NULL DEFAULT 'todo',
            notes TEXT DEFAULT '',
            priority INTEGER NOT NULL DEFAULT 1,
            due_at TEXT NULL,
            alarm_enabled INTEGER NOT NULL DEFAULT 0,
            required_frequency TEXT NOT NULL DEFAULT 'daily',
            frequency_days INTEGER NOT NULL DEFAULT 1,
            points_awarded INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS rewards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            cost_points INTEGER NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1
        )
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS point_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER NULL,
            points_delta INTEGER NOT NULL,
            reason TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS streaks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER NOT NULL UNIQUE,
            current_streak INTEGER NOT NULL DEFAULT 0,
            best_streak INTEGER NOT NULL DEFAULT 0,
            last_completed_date TEXT NULL
        )
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS redemptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reward_id INTEGER NOT NULL,
            cost_points INTEGER NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS notification_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER NULL,
            event_key TEXT NOT NULL UNIQUE,
            event_type TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            deadline_at TEXT NULL,
            tags TEXT NOT NULL DEFAULT '[]',
            priority INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            goal_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            deadline_at TEXT NULL,
            tags TEXT NOT NULL DEFAULT '[]',
            priority INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            parent_id INTEGER NULL,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            state TEXT NOT NULL DEFAULT 'todo',
            notes TEXT DEFAULT '',
            priority INTEGER NOT NULL DEFAULT 1,
            due_at TEXT NULL,
            alarm_enabled INTEGER NOT NULL DEFAULT 0,
            required_frequency TEXT NOT NULL DEFAULT 'daily',
            frequency_days INTEGER NOT NULL DEFAULT 1,
            points_awarded INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )

    cur.execute("CREATE INDEX IF NOT EXISTS idx_projects_goal_id ON projects(goal_id)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id)")

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS auth_config (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS auth_sessions (
            token TEXT PRIMARY KEY,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS notification_settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            email_enabled INTEGER NOT NULL DEFAULT 0,
            smtp_host TEXT NOT NULL DEFAULT '',
            smtp_port INTEGER NOT NULL DEFAULT 587,
            smtp_username TEXT NOT NULL DEFAULT '',
            smtp_password TEXT NOT NULL DEFAULT '',
            smtp_use_tls INTEGER NOT NULL DEFAULT 1,
            from_email TEXT NOT NULL DEFAULT '',
            to_email TEXT NOT NULL DEFAULT ''
        )
        """
    )
    cur.execute(
        """
        INSERT OR IGNORE INTO notification_settings
            (id, email_enabled, smtp_host, smtp_port, smtp_username, smtp_password, smtp_use_tls, from_email, to_email)
        VALUES
            (1, 0, '', 587, '', '', 1, '', '')
        """
    )

    # Lightweight migration-safe upgrades for existing databases.
    existing = {row["name"] for row in cur.execute("PRAGMA table_info(items)").fetchall()}
    if "required_frequency" not in existing:
        cur.execute("ALTER TABLE items ADD COLUMN required_frequency TEXT NOT NULL DEFAULT 'daily'")
    if "frequency_days" not in existing:
        cur.execute("ALTER TABLE items ADD COLUMN frequency_days INTEGER NOT NULL DEFAULT 1")

    task_existing = {row["name"] for row in cur.execute("PRAGMA table_info(tasks)").fetchall()}
    if "parent_id" not in task_existing:
        cur.execute("ALTER TABLE tasks ADD COLUMN parent_id INTEGER NULL")

    conn.commit()
    conn.close()
