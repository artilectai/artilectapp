from datetime import datetime
from .supabase_link import sb
from .utils import parse_time_tomorrow

def create_task_from_text(user_id: str, text: str) -> dict:
    due = parse_time_tomorrow(text)
    title = text.strip().capitalize()
    s = sb()
    ins = s.table("tasks").insert({
        "user_id": user_id,
        "title": title,
        "status": "todo",
        "priority": "medium",
        "due_date": due.isoformat() if due else None,
    }).execute()
    return {"ok": True, "id": ins.data[0]["id"], "due_date": due.isoformat() if due else None}

def create_task_structured(user_id: str, data: dict) -> dict:
    title = (data.get("title") or "Task").strip()
    due = data.get("dueAt") or data.get("due_date")
    start = data.get("startAt") or data.get("start_date")
    priority = data.get("priority") or "medium"
    s = sb()
    ins = s.table("tasks").insert({
        "user_id": user_id,
        "title": title,
        "status": "todo",
        "priority": priority,
        "due_date": due,
        "start_date": start,
    }).execute()
    return {"ok": True, "id": ins.data[0]["id"], "due_date": due}
