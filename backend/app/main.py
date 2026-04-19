import json
import hashlib
import hmac
import secrets
import smtplib
from datetime import date, datetime, time, timedelta
from email.message import EmailMessage
from typing import Any, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .database import get_connection, init_db
from .schemas import (
    AuthLoginIn,
    AuthResetIn,
    AuthSetupIn,
    AuthStatusOut,
    AuthTokenOut,
    GoalCreate,
    GoalOut,
    GoalReorderEntry,
    GoalUpdate,
    ItemCreate,
    ItemOut,
    ItemUpdate,
    NotificationSettingsOut,
    NotificationSettingsUpdate,
    ProjectCreate,
    ProjectOut,
    ProjectUpdate,
    RewardCreate,
    RewardOut,
    SummaryOut,
    TaskCreate,
    TaskOut,
    TaskUpdate,
    TimelineGroup,
)


POINTS_BY_PRIORITY = {1: 5, 2: 10, 3: 20}
SESSION_DURATION_HOURS = 24
AUTH_EXEMPT_PATHS = {
    "/health",
    "/auth/status",
    "/auth/setup",
    "/auth/login",
    "/auth/forgot-password",
    "/docs",
    "/openapi.json",
    "/redoc",
}

app = FastAPI(title="Priority Stack API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _hash_password(password: str, salt: str) -> str:
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), 200_000)
    return digest.hex()


def _create_auth_config(password: str) -> None:
    salt = secrets.token_hex(16)
    now = _now_iso()
    conn = get_connection()
    conn.execute(
        "INSERT OR REPLACE INTO auth_config (id, password_hash, salt, updated_at) VALUES (1, ?, ?, ?)",
        (_hash_password(password, salt), salt, now),
    )
    conn.execute("DELETE FROM auth_sessions")
    conn.commit()
    conn.close()


def _has_master_password() -> bool:
    conn = get_connection()
    row = conn.execute("SELECT id FROM auth_config WHERE id = 1").fetchone()
    conn.close()
    return row is not None


def _verify_password(password: str) -> bool:
    conn = get_connection()
    row = conn.execute("SELECT password_hash, salt FROM auth_config WHERE id = 1").fetchone()
    conn.close()
    if row is None:
        return False
    computed = _hash_password(password, row["salt"])
    return hmac.compare_digest(computed, row["password_hash"])


def _create_session_token() -> str:
    now = datetime.utcnow()
    expires_at = (now + timedelta(hours=SESSION_DURATION_HOURS)).isoformat()
    token = secrets.token_urlsafe(48)
    conn = get_connection()
    conn.execute(
        "INSERT INTO auth_sessions (token, expires_at, created_at) VALUES (?, ?, ?)",
        (token, expires_at, now.isoformat()),
    )
    conn.commit()
    conn.close()
    return token


def _is_session_token_valid(token: str) -> bool:
    conn = get_connection()
    row = conn.execute("SELECT expires_at FROM auth_sessions WHERE token = ?", (token,)).fetchone()
    if row is None:
        conn.close()
        return False
    if datetime.fromisoformat(row["expires_at"]) <= datetime.utcnow():
        conn.execute("DELETE FROM auth_sessions WHERE token = ?", (token,))
        conn.commit()
        conn.close()
        return False
    conn.close()
    return True


def _now_iso() -> str:
    return datetime.utcnow().isoformat()


def _parse_item(row: Any) -> dict[str, Any]:
    return {
        "id": row["id"],
        "parent_id": row["parent_id"],
        "title": row["title"],
        "description": row["description"],
        "state": row["state"],
        "notes": row["notes"],
        "priority": row["priority"],
        "due_at": row["due_at"],
        "alarm_enabled": bool(row["alarm_enabled"]),
        "required_frequency": row["required_frequency"],
        "frequency_days": row["frequency_days"],
        "points_awarded": row["points_awarded"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _parse_goal(row: Any) -> dict[str, Any]:
    return {
        "id": row["id"],
        "title": row["title"],
        "description": row["description"],
        "deadline_at": row["deadline_at"],
        "tags": json.loads(row["tags"] or "[]"),
        "priority": row["priority"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _parse_project(row: Any) -> dict[str, Any]:
    return {
        "id": row["id"],
        "goal_id": row["goal_id"],
        "title": row["title"],
        "description": row["description"],
        "deadline_at": row["deadline_at"],
        "tags": json.loads(row["tags"] or "[]"),
        "priority": row["priority"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _parse_task(row: Any) -> dict[str, Any]:
    return {
        "id": row["id"],
        "project_id": row["project_id"],
        "parent_id": row["parent_id"],
        "title": row["title"],
        "description": row["description"],
        "state": row["state"],
        "notes": row["notes"],
        "priority": row["priority"],
        "due_at": row["due_at"],
        "alarm_enabled": bool(row["alarm_enabled"]),
        "required_frequency": row["required_frequency"],
        "frequency_days": row["frequency_days"],
        "points_awarded": row["points_awarded"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _parse_notification_settings(row: Any) -> dict[str, Any]:
    return {
        "email_enabled": bool(row["email_enabled"]),
        "smtp_host": row["smtp_host"] or "",
        "smtp_port": int(row["smtp_port"] or 587),
        "smtp_username": row["smtp_username"] or "",
        "smtp_password": row["smtp_password"] or "",
        "smtp_use_tls": bool(row["smtp_use_tls"]),
        "from_email": row["from_email"] or "",
        "to_email": row["to_email"] or "",
    }


def _load_notification_settings(conn: Any) -> dict[str, Any]:
    row = conn.execute("SELECT * FROM notification_settings WHERE id = 1").fetchone()
    if row is None:
        conn.execute(
            """
            INSERT INTO notification_settings
                (id, email_enabled, smtp_host, smtp_port, smtp_username, smtp_password, smtp_use_tls, from_email, to_email)
            VALUES
                (1, 0, '', 587, '', '', 1, '', '')
            """
        )
        conn.commit()
        row = conn.execute("SELECT * FROM notification_settings WHERE id = 1").fetchone()
    return _parse_notification_settings(row)


def _can_send_email(settings: dict[str, Any]) -> bool:
    return (
        settings["email_enabled"]
        and bool(settings["smtp_host"])
        and bool(settings["from_email"])
        and bool(settings["to_email"])
        and bool(settings["smtp_username"])
        and bool(settings["smtp_password"])
    )


def _send_notification_email(settings: dict[str, Any], notifications: list[dict[str, Any]]) -> None:
    if not notifications:
        return
    msg = EmailMessage()
    msg["Subject"] = f"PrioStack reminders ({len(notifications)})"
    msg["From"] = settings["from_email"]
    msg["To"] = settings["to_email"]
    body = "\n".join([f"- {entry['title']}: {entry['message']}" for entry in notifications])
    msg.set_content(f"You have {len(notifications)} new PrioStack notifications.\n\n{body}")

    with smtplib.SMTP(settings["smtp_host"], settings["smtp_port"], timeout=15) as smtp:
        if settings["smtp_use_tls"]:
            smtp.starttls()
        smtp.login(settings["smtp_username"], settings["smtp_password"])
        smtp.send_message(msg)


def _send_login_email(settings: dict[str, Any]) -> None:
    msg = EmailMessage()
    msg["Subject"] = "PrioStack login alert"
    msg["From"] = settings["from_email"]
    msg["To"] = settings["to_email"]
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    msg.set_content(f"A new login to your PrioStack account was detected at {now}.")

    with smtplib.SMTP(settings["smtp_host"], settings["smtp_port"], timeout=15) as smtp:
        if settings["smtp_use_tls"]:
            smtp.starttls()
        smtp.login(settings["smtp_username"], settings["smtp_password"])
        smtp.send_message(msg)


def _date_window(view: str, pivot: date) -> tuple[datetime, datetime]:
    if view == "day":
        start = datetime.combine(pivot, time.min)
        end = start + timedelta(days=1)
    elif view == "week":
        start_day = pivot - timedelta(days=pivot.weekday())
        start = datetime.combine(start_day, time.min)
        end = start + timedelta(days=7)
    elif view == "month":
        start = datetime.combine(pivot.replace(day=1), time.min)
        if start.month == 12:
            end = datetime.combine(date(start.year + 1, 1, 1), time.min)
        else:
            end = datetime.combine(date(start.year, start.month + 1, 1), time.min)
    else:
        raise HTTPException(status_code=400, detail="view must be one of: day, week, month")
    return start, end


def _frequency_gap_days(item: dict[str, Any]) -> int:
    frequency = item.get("required_frequency", "daily")
    if frequency == "weekly":
        return 7
    return int(item.get("frequency_days") or 1)


def _ensure_streak_valid(item_id: int) -> None:
    conn = get_connection()
    item_row = conn.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone()
    streak_row = conn.execute("SELECT * FROM streaks WHERE item_id = ?", (item_id,)).fetchone()
    if item_row is None or streak_row is None or not streak_row["last_completed_date"]:
        conn.close()
        return
    item = _parse_item(item_row)
    last_date = datetime.fromisoformat(streak_row["last_completed_date"]).date()
    gap = (datetime.utcnow().date() - last_date).days
    if gap > _frequency_gap_days(item):
        conn.execute("UPDATE streaks SET current_streak = 0 WHERE item_id = ?", (item_id,))
        conn.commit()
    conn.close()


def _update_streak(item_id: int) -> None:
    today = datetime.utcnow().date()
    conn = get_connection()
    cur = conn.cursor()
    item_row = cur.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone()
    if item_row is None:
        conn.close()
        return
    item = _parse_item(item_row)
    max_gap_days = _frequency_gap_days(item)
    row = cur.execute("SELECT * FROM streaks WHERE item_id = ?", (item_id,)).fetchone()
    if row is None:
        cur.execute(
            "INSERT INTO streaks (item_id, current_streak, best_streak, last_completed_date) VALUES (?, 1, 1, ?)",
            (item_id, today.isoformat()),
        )
    else:
        last = row["last_completed_date"]
        current = row["current_streak"]
        if last:
            last_date = datetime.fromisoformat(last).date()
            if last_date == today:
                conn.close()
                return
            if (today - last_date).days <= max_gap_days:
                current += 1
            else:
                current = 1
        else:
            current = 1
        best = max(current, row["best_streak"])
        cur.execute(
            "UPDATE streaks SET current_streak = ?, best_streak = ?, last_completed_date = ? WHERE item_id = ?",
            (current, best, today.isoformat(), item_id),
        )
    conn.commit()
    conn.close()


@app.on_event("startup")
def startup() -> None:
    init_db()


@app.middleware("http")
async def require_authentication(request: Request, call_next):
    path = request.url.path
    if request.method == "OPTIONS":
        return await call_next(request)
    if path in AUTH_EXEMPT_PATHS:
        return await call_next(request)
    if not _has_master_password():
        return JSONResponse(status_code=401, content={"detail": "Master password is not set"})
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        return JSONResponse(status_code=401, content={"detail": "Authentication required"})
    token = auth_header.split(" ", 1)[1].strip()
    if not token or not _is_session_token_valid(token):
        return JSONResponse(status_code=401, content={"detail": "Invalid or expired session"})
    return await call_next(request)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/auth/status", response_model=AuthStatusOut)
def auth_status(request: Request) -> dict[str, bool]:
    configured = _has_master_password()
    if not configured:
        return {"configured": False, "authenticated": False}
    auth_header = request.headers.get("authorization", "")
    token = auth_header.split(" ", 1)[1].strip() if auth_header.startswith("Bearer ") else ""
    authenticated = _is_session_token_valid(token) if token else False
    return {"configured": True, "authenticated": authenticated}


@app.post("/auth/setup", response_model=AuthTokenOut)
def auth_setup(payload: AuthSetupIn) -> dict[str, str]:
    if _has_master_password():
        raise HTTPException(status_code=400, detail="Master password is already configured")
    _create_auth_config(payload.password)
    return {"token": _create_session_token()}


@app.post("/auth/login", response_model=AuthTokenOut)
def auth_login(payload: AuthLoginIn) -> dict[str, str]:
    if not _has_master_password():
        raise HTTPException(status_code=400, detail="Master password is not configured")
    if not _verify_password(payload.password):
        raise HTTPException(status_code=401, detail="Invalid password")
    token = _create_session_token()

    # Best effort: login must not fail if mail transport is unavailable.
    conn = get_connection()
    settings = _load_notification_settings(conn)
    conn.close()
    if _can_send_email(settings):
        try:
            _send_login_email(settings)
        except Exception:
            pass
    return {"token": token}


@app.post("/auth/forgot-password", response_model=AuthTokenOut)
def forgot_password(payload: AuthResetIn) -> dict[str, str]:
    _create_auth_config(payload.new_password)
    return {"token": _create_session_token()}


@app.get("/goals", response_model=list[GoalOut])
def list_goals() -> list[dict[str, Any]]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM goals ORDER BY priority DESC, COALESCE(deadline_at, '9999-12-31T23:59:59') ASC, id DESC"
    ).fetchall()
    conn.close()
    return [_parse_goal(row) for row in rows]


@app.post("/goals", response_model=GoalOut)
def create_goal(payload: GoalCreate) -> dict[str, Any]:
    conn = get_connection()
    now = _now_iso()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO goals (title, description, deadline_at, tags, priority, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            payload.title.strip(),
            payload.description,
            payload.deadline_at.isoformat() if payload.deadline_at else None,
            json.dumps(payload.tags),
            payload.priority,
            now,
            now,
        ),
    )
    goal_id = cur.lastrowid
    row = cur.execute("SELECT * FROM goals WHERE id = ?", (goal_id,)).fetchone()
    conn.commit()
    conn.close()
    return _parse_goal(row)


@app.patch("/goals/{goal_id}", response_model=GoalOut)
def update_goal(goal_id: int, payload: GoalUpdate) -> dict[str, Any]:
    conn = get_connection()
    row = conn.execute("SELECT * FROM goals WHERE id = ?", (goal_id,)).fetchone()
    if row is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Goal not found")
    data = _parse_goal(row)
    updates = payload.model_dump(exclude_none=True)
    data.update(updates)
    if isinstance(data.get("deadline_at"), datetime):
        data["deadline_at"] = data["deadline_at"].isoformat()
    data["updated_at"] = _now_iso()
    conn.execute(
        "UPDATE goals SET title = ?, description = ?, deadline_at = ?, tags = ?, priority = ?, updated_at = ? WHERE id = ?",
        (
            data["title"],
            data["description"],
            data["deadline_at"],
            json.dumps(data["tags"]),
            data["priority"],
            data["updated_at"],
            goal_id,
        ),
    )
    row = conn.execute("SELECT * FROM goals WHERE id = ?", (goal_id,)).fetchone()
    conn.commit()
    conn.close()
    return _parse_goal(row)


@app.delete("/goals/{goal_id}")
def delete_goal(goal_id: int) -> dict[str, bool]:
    conn = get_connection()
    projects = conn.execute("SELECT id FROM projects WHERE goal_id = ?", (goal_id,)).fetchall()
    for project in projects:
        conn.execute("DELETE FROM tasks WHERE project_id = ?", (project["id"],))
    conn.execute("DELETE FROM projects WHERE goal_id = ?", (goal_id,))
    conn.execute("DELETE FROM goals WHERE id = ?", (goal_id,))
    conn.commit()
    conn.close()
    return {"success": True}


@app.post("/goals/reorder")
def reorder_goals(payload: list[GoalReorderEntry]) -> dict[str, bool]:
    conn = get_connection()
    for entry in payload:
        conn.execute("UPDATE goals SET priority = ?, updated_at = ? WHERE id = ?", (entry.priority, _now_iso(), entry.id))
    conn.commit()
    conn.close()
    return {"success": True}


@app.get("/projects", response_model=list[ProjectOut])
def list_all_projects() -> list[dict[str, Any]]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM projects ORDER BY COALESCE(deadline_at, '9999-12-31T23:59:59') ASC, priority DESC, id DESC"
    ).fetchall()
    conn.close()
    return [_parse_project(row) for row in rows]


@app.get("/goals/{goal_id}/projects", response_model=list[ProjectOut])
def list_projects(goal_id: int) -> list[dict[str, Any]]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM projects WHERE goal_id = ? ORDER BY priority DESC, COALESCE(deadline_at, '9999-12-31T23:59:59') ASC, id DESC",
        (goal_id,),
    ).fetchall()
    conn.close()
    return [_parse_project(row) for row in rows]


@app.post("/goals/{goal_id}/projects", response_model=ProjectOut)
def create_project(goal_id: int, payload: ProjectCreate) -> dict[str, Any]:
    conn = get_connection()
    if conn.execute("SELECT id FROM goals WHERE id = ?", (goal_id,)).fetchone() is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Goal not found")
    now = _now_iso()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO projects (goal_id, title, description, deadline_at, tags, priority, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            goal_id,
            payload.title.strip(),
            payload.description,
            payload.deadline_at.isoformat() if payload.deadline_at else None,
            json.dumps(payload.tags),
            payload.priority,
            now,
            now,
        ),
    )
    project_id = cur.lastrowid
    row = cur.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    conn.commit()
    conn.close()
    return _parse_project(row)


@app.patch("/projects/{project_id}", response_model=ProjectOut)
def update_project(project_id: int, payload: ProjectUpdate) -> dict[str, Any]:
    conn = get_connection()
    row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    if row is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Project not found")
    data = _parse_project(row)
    updates = payload.model_dump(exclude_none=True)
    data.update(updates)
    if isinstance(data.get("deadline_at"), datetime):
        data["deadline_at"] = data["deadline_at"].isoformat()
    data["updated_at"] = _now_iso()
    conn.execute(
        "UPDATE projects SET title = ?, description = ?, deadline_at = ?, tags = ?, priority = ?, updated_at = ? WHERE id = ?",
        (data["title"], data["description"], data["deadline_at"], json.dumps(data["tags"]), data["priority"], data["updated_at"], project_id),
    )
    row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    conn.commit()
    conn.close()
    return _parse_project(row)


@app.delete("/projects/{project_id}")
def delete_project(project_id: int) -> dict[str, bool]:
    conn = get_connection()
    conn.execute("DELETE FROM tasks WHERE project_id = ?", (project_id,))
    conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
    conn.commit()
    conn.close()
    return {"success": True}


@app.get("/tasks", response_model=list[TaskOut])
def list_all_tasks() -> list[dict[str, Any]]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM tasks ORDER BY COALESCE(due_at, '9999-12-31T23:59:59') ASC, priority DESC, id DESC"
    ).fetchall()
    conn.close()
    return [_parse_task(row) for row in rows]


@app.get("/projects/{project_id}/tasks", response_model=list[TaskOut])
def list_tasks(project_id: int) -> list[dict[str, Any]]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM tasks WHERE project_id = ? ORDER BY priority DESC, COALESCE(due_at, '9999-12-31T23:59:59') ASC, id DESC",
        (project_id,),
    ).fetchall()
    conn.close()
    return [_parse_task(row) for row in rows]


@app.post("/projects/{project_id}/tasks", response_model=TaskOut)
def create_task(project_id: int, payload: TaskCreate) -> dict[str, Any]:
    conn = get_connection()
    if conn.execute("SELECT id FROM projects WHERE id = ?", (project_id,)).fetchone() is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Project not found")
    now = _now_iso()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO tasks (project_id, parent_id, title, description, state, notes, priority, due_at, alarm_enabled, required_frequency, frequency_days, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            project_id,
            payload.parent_id,
            payload.title.strip(),
            payload.description,
            payload.state,
            payload.notes,
            payload.priority,
            payload.due_at.isoformat() if payload.due_at else None,
            int(payload.alarm_enabled),
            payload.required_frequency,
            payload.frequency_days,
            now,
            now,
        ),
    )
    task_id = cur.lastrowid
    row = cur.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    conn.commit()
    conn.close()
    return _parse_task(row)


@app.patch("/tasks/{task_id}", response_model=TaskOut)
def update_task(task_id: int, payload: TaskUpdate) -> dict[str, Any]:
    conn = get_connection()
    row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    if row is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Task not found")
    data = _parse_task(row)
    updates = payload.model_dump(exclude_none=True)
    for key, value in updates.items():
        data[key] = value.isoformat() if key == "due_at" and value is not None else value
    data["updated_at"] = _now_iso()
    conn.execute(
        """
        UPDATE tasks SET parent_id = ?, title = ?, description = ?, state = ?, notes = ?, priority = ?, due_at = ?, alarm_enabled = ?, required_frequency = ?, frequency_days = ?, updated_at = ?
        WHERE id = ?
        """,
        (
            data["parent_id"],
            data["title"],
            data["description"],
            data["state"],
            data["notes"],
            data["priority"],
            data["due_at"],
            int(data["alarm_enabled"]),
            data["required_frequency"],
            data["frequency_days"],
            data["updated_at"],
            task_id,
        ),
    )
    row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    conn.commit()
    conn.close()
    return _parse_task(row)


@app.delete("/tasks/{task_id}")
def delete_task(task_id: int) -> dict[str, bool]:
    conn = get_connection()
    conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    conn.commit()
    conn.close()
    return {"success": True}


@app.post("/tasks/{task_id}/complete", response_model=TaskOut)
def complete_task(task_id: int) -> dict[str, Any]:
    conn = get_connection()
    row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    if row is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Task not found")
    task = _parse_task(row)
    if task["state"] != "done":
        points = POINTS_BY_PRIORITY.get(int(task["priority"]), 5)
        now = _now_iso()
        conn.execute("UPDATE tasks SET state = 'done', points_awarded = ?, updated_at = ? WHERE id = ?", (points, now, task_id))
        conn.execute(
            "INSERT INTO point_events (item_id, points_delta, reason, created_at) VALUES (?, ?, ?, ?)",
            (None, points, f"task_complete:{task_id}", now),
        )
        conn.commit()
    row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    conn.close()
    return _parse_task(row)


@app.get("/items", response_model=list[ItemOut])
def list_items() -> list[dict[str, Any]]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM items ORDER BY priority DESC, COALESCE(due_at, '9999-12-31T23:59:59') ASC, id DESC"
    ).fetchall()
    conn.close()
    return [_parse_item(row) for row in rows]


@app.get("/items/{item_id}/children", response_model=list[ItemOut])
def list_children(item_id: int) -> list[dict[str, Any]]:
    conn = get_connection()
    rows = conn.execute(
        """
        SELECT * FROM items
        WHERE parent_id = ?
        ORDER BY priority DESC, COALESCE(due_at, '9999-12-31T23:59:59') ASC, id DESC
        """,
        (item_id,),
    ).fetchall()
    conn.close()
    return [_parse_item(row) for row in rows]


@app.post("/items", response_model=ItemOut)
def create_item(payload: ItemCreate) -> dict[str, Any]:
    conn = get_connection()
    now = _now_iso()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO items (parent_id, title, description, state, notes, priority, due_at, alarm_enabled, required_frequency, frequency_days, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            payload.parent_id,
            payload.title.strip(),
            payload.description,
            payload.state,
            payload.notes,
            payload.priority,
            payload.due_at.isoformat() if payload.due_at else None,
            int(payload.alarm_enabled),
            payload.required_frequency,
            payload.frequency_days,
            now,
            now,
        ),
    )
    item_id = cur.lastrowid
    row = cur.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone()
    conn.commit()
    conn.close()
    return _parse_item(row)


@app.patch("/items/{item_id}", response_model=ItemOut)
def update_item(item_id: int, payload: ItemUpdate) -> dict[str, Any]:
    conn = get_connection()
    row = conn.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone()
    if row is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Item not found")

    data = _parse_item(row)
    updates = payload.model_dump(exclude_none=True)
    for key, value in updates.items():
        if key == "due_at" and value is not None:
            data[key] = value.isoformat()
        else:
            data[key] = value
    data["updated_at"] = _now_iso()

    conn.execute(
        """
        UPDATE items SET parent_id = ?, title = ?, description = ?, state = ?, notes = ?, priority = ?, due_at = ?, alarm_enabled = ?, required_frequency = ?, frequency_days = ?, updated_at = ?
        WHERE id = ?
        """,
        (
            data["parent_id"],
            data["title"],
            data["description"],
            data["state"],
            data["notes"],
            data["priority"],
            data["due_at"],
            int(data["alarm_enabled"]),
            data["required_frequency"],
            data["frequency_days"],
            data["updated_at"],
            item_id,
        ),
    )
    row = conn.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone()
    conn.commit()
    conn.close()
    return _parse_item(row)


@app.delete("/items/{item_id}")
def delete_item(item_id: int) -> dict[str, bool]:
    conn = get_connection()
    conn.execute("DELETE FROM items WHERE id = ? OR parent_id = ?", (item_id, item_id))
    conn.commit()
    conn.close()
    return {"success": True}


@app.post("/items/{item_id}/complete", response_model=ItemOut)
def complete_item(item_id: int) -> dict[str, Any]:
    conn = get_connection()
    row = conn.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone()
    if row is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Item not found")

    item = _parse_item(row)
    if item["state"] != "done":
        points = POINTS_BY_PRIORITY.get(int(item["priority"]), 5)
        now = _now_iso()
        conn.execute(
            "UPDATE items SET state = 'done', points_awarded = ?, updated_at = ? WHERE id = ?",
            (points, now, item_id),
        )
        conn.execute(
            "INSERT INTO point_events (item_id, points_delta, reason, created_at) VALUES (?, ?, ?, ?)",
            (item_id, points, "task_complete", now),
        )
        conn.commit()
    conn.close()
    _update_streak(item_id)
    conn = get_connection()
    row = conn.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone()
    conn.close()
    return _parse_item(row)


@app.get("/rewards", response_model=list[RewardOut])
def list_rewards() -> list[dict[str, Any]]:
    conn = get_connection()
    rows = conn.execute("SELECT * FROM rewards ORDER BY cost_points ASC, id ASC").fetchall()
    conn.close()
    return [{"id": r["id"], "name": r["name"], "cost_points": r["cost_points"], "is_active": bool(r["is_active"])} for r in rows]


@app.post("/rewards", response_model=RewardOut)
def create_reward(payload: RewardCreate) -> dict[str, Any]:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO rewards (name, cost_points, is_active) VALUES (?, ?, ?)",
        (payload.name, payload.cost_points, int(payload.is_active)),
    )
    reward_id = cur.lastrowid
    row = cur.execute("SELECT * FROM rewards WHERE id = ?", (reward_id,)).fetchone()
    conn.commit()
    conn.close()
    return {"id": row["id"], "name": row["name"], "cost_points": row["cost_points"], "is_active": bool(row["is_active"])}


@app.post("/rewards/{reward_id}/redeem")
def redeem_reward(reward_id: int) -> dict[str, Any]:
    conn = get_connection()
    reward = conn.execute("SELECT * FROM rewards WHERE id = ? AND is_active = 1", (reward_id,)).fetchone()
    if reward is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Reward not found")

    balance_row = conn.execute("SELECT COALESCE(SUM(points_delta), 0) AS balance FROM point_events").fetchone()
    balance = int(balance_row["balance"])
    cost = int(reward["cost_points"])
    if balance < cost:
        conn.close()
        raise HTTPException(status_code=400, detail="Insufficient points")

    now = _now_iso()
    conn.execute(
        "INSERT INTO point_events (item_id, points_delta, reason, created_at) VALUES (?, ?, ?, ?)",
        (None, -cost, "reward_redeem", now),
    )
    conn.execute(
        "INSERT INTO redemptions (reward_id, cost_points, created_at) VALUES (?, ?, ?)",
        (reward_id, cost, now),
    )
    conn.commit()
    conn.close()
    return {"success": True, "remaining_points": balance - cost}


@app.get("/items/timeline", response_model=list[TimelineGroup])
def items_timeline(view: str = "day", date_ref: Optional[str] = None) -> list[dict[str, Any]]:
    pivot = datetime.fromisoformat(date_ref).date() if date_ref else datetime.utcnow().date()
    start, end = _date_window(view, pivot)
    conn = get_connection()
    rows = conn.execute(
        """
        SELECT * FROM tasks
        WHERE due_at IS NOT NULL AND due_at >= ? AND due_at < ?
        ORDER BY due_at ASC, priority DESC, id DESC
        """,
        (start.isoformat(), end.isoformat()),
    ).fetchall()
    conn.close()

    grouped: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        item = _parse_task(row)
        due = datetime.fromisoformat(item["due_at"])
        if view == "day":
            key = due.strftime("%H:%M")
        elif view == "week":
            key = due.strftime("%a")
        else:
            key = due.strftime("%Y-%m-%d")
        grouped.setdefault(key, []).append(item)
    return [{"label": key, "items": value} for key, value in grouped.items()]


def _collect_pending_notifications(conn: Any, now: datetime) -> list[dict[str, Any]]:
    payload: list[dict[str, Any]] = []
    items = conn.execute(
        "SELECT * FROM tasks WHERE state != 'done' AND due_at IS NOT NULL AND alarm_enabled = 1"
    ).fetchall()
    for row in items:
        item = _parse_task(row)
        due = datetime.fromisoformat(item["due_at"])
        minutes_left = int((due - now).total_seconds() // 60)
        for marker in (30, 15):
            if 0 <= minutes_left <= marker:
                event_key = f"task:{item['id']}:{marker}:{due.date().isoformat()}"
                exists = conn.execute("SELECT id FROM notification_events WHERE event_key = ?", (event_key,)).fetchone()
                if exists is None:
                    conn.execute(
                        "INSERT INTO notification_events (item_id, event_key, event_type, created_at) VALUES (?, ?, ?, ?)",
                        (item["id"], event_key, "task_reminder", now.isoformat()),
                    )
                    payload.append(
                        {
                            "type": "task_reminder",
                            "title": "Task reminder",
                            "message": f"{item['title']} is due in about {marker} minutes.",
                        }
                    )

    report_window = "morning" if 7 <= now.hour < 12 else "evening" if 18 <= now.hour < 23 else None
    if report_window:
        event_key = f"report:{report_window}:{now.date().isoformat()}"
        exists = conn.execute("SELECT id FROM notification_events WHERE event_key = ?", (event_key,)).fetchone()
        if exists is None:
            summary_row = conn.execute(
                "SELECT COUNT(*) AS total, SUM(CASE WHEN state = 'done' THEN 1 ELSE 0 END) AS done FROM tasks"
            ).fetchone()
            points = int(conn.execute("SELECT COALESCE(SUM(points_delta), 0) AS s FROM point_events").fetchone()["s"])
            conn.execute(
                "INSERT INTO notification_events (item_id, event_key, event_type, created_at) VALUES (?, ?, ?, ?)",
                (None, event_key, "daily_report", now.isoformat()),
            )
            payload.append(
                {
                    "type": "daily_report",
                    "title": "Priority Stack report",
                    "message": f"{report_window.title()} summary: {summary_row['done'] or 0}/{summary_row['total']} done, {points} points.",
                }
            )
    return payload


@app.get("/notifications/pending")
def pending_notifications(send_email: bool = False) -> list[dict[str, Any]]:
    now = datetime.utcnow()
    conn = get_connection()
    payload = _collect_pending_notifications(conn, now)
    if send_email and payload:
        settings = _load_notification_settings(conn)
        if _can_send_email(settings):
            try:
                _send_notification_email(settings, payload)
            except Exception:
                pass
    conn.commit()
    conn.close()
    return payload


@app.get("/notifications/settings", response_model=NotificationSettingsOut)
def get_notification_settings() -> dict[str, Any]:
    conn = get_connection()
    settings = _load_notification_settings(conn)
    conn.close()
    return {
        "email_enabled": settings["email_enabled"],
        "smtp_host": settings["smtp_host"],
        "smtp_port": settings["smtp_port"],
        "smtp_username": settings["smtp_username"],
        "smtp_password_set": bool(settings["smtp_password"]),
        "smtp_use_tls": settings["smtp_use_tls"],
        "from_email": settings["from_email"],
        "to_email": settings["to_email"],
    }


@app.patch("/notifications/settings", response_model=NotificationSettingsOut)
def update_notification_settings(payload: NotificationSettingsUpdate) -> dict[str, Any]:
    conn = get_connection()
    current = _load_notification_settings(conn)
    updates = payload.model_dump(exclude_none=True)
    current.update(updates)
    conn.execute(
        """
        UPDATE notification_settings
        SET email_enabled = ?, smtp_host = ?, smtp_port = ?, smtp_username = ?, smtp_password = ?, smtp_use_tls = ?, from_email = ?, to_email = ?
        WHERE id = 1
        """,
        (
            int(bool(current["email_enabled"])),
            current["smtp_host"],
            int(current["smtp_port"]),
            current["smtp_username"],
            current["smtp_password"],
            int(bool(current["smtp_use_tls"])),
            current["from_email"],
            current["to_email"],
        ),
    )
    conn.commit()
    settings = _load_notification_settings(conn)
    conn.close()
    return {
        "email_enabled": settings["email_enabled"],
        "smtp_host": settings["smtp_host"],
        "smtp_port": settings["smtp_port"],
        "smtp_username": settings["smtp_username"],
        "smtp_password_set": bool(settings["smtp_password"]),
        "smtp_use_tls": settings["smtp_use_tls"],
        "from_email": settings["from_email"],
        "to_email": settings["to_email"],
    }


@app.post("/notifications/send-test")
def send_test_notification() -> dict[str, bool]:
    conn = get_connection()
    settings = _load_notification_settings(conn)
    conn.close()
    if not _can_send_email(settings):
        raise HTTPException(status_code=400, detail="Email notification settings are incomplete")
    try:
        _send_notification_email(
            settings,
            [{"title": "Test notification", "message": "PrioStack email notifications are configured.", "type": "test"}],
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Unable to send test email: {exc}") from exc
    return {"success": True}


@app.get("/dashboard/summary", response_model=SummaryOut)
def dashboard_summary(view: Optional[str] = None, date_ref: Optional[str] = None) -> dict[str, Any]:
    pivot = datetime.fromisoformat(date_ref).date() if date_ref else datetime.utcnow().date()
    conn = get_connection()
    if view:
        start, end = _date_window(view, pivot)
        total_items = int(
            conn.execute(
                "SELECT COUNT(*) AS c FROM tasks WHERE created_at >= ? AND created_at < ?",
                (start.isoformat(), end.isoformat()),
            ).fetchone()["c"]
        )
        done_items = int(
            conn.execute(
                "SELECT COUNT(*) AS c FROM tasks WHERE state = 'done' AND updated_at >= ? AND updated_at < ?",
                (start.isoformat(), end.isoformat()),
            ).fetchone()["c"]
        )
    else:
        total_items = int(conn.execute("SELECT COUNT(*) AS c FROM tasks").fetchone()["c"])
        done_items = int(conn.execute("SELECT COUNT(*) AS c FROM tasks WHERE state = 'done'").fetchone()["c"])

    point_balance = int(conn.execute("SELECT COALESCE(SUM(points_delta), 0) AS s FROM point_events").fetchone()["s"])
    active_streaks = 0
    conn.close()
    completion_rate = (done_items / total_items) if total_items else 0.0
    return {
        "total_items": total_items,
        "done_items": done_items,
        "completion_rate": round(completion_rate, 2),
        "point_balance": point_balance,
        "active_streaks": active_streaks,
    }
