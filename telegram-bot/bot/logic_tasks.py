from datetime import datetime, timezone
from .supabase_link import sb
from .utils import parse_time_tomorrow, parse_time_today_or_tomorrow, summarize_task_title

def create_task_from_text(user_id: str, text: str) -> dict:
    # Try robust parser first; fallback to legacy 'tomorrow ... at' matcher
    due = parse_time_today_or_tomorrow(text) or parse_time_tomorrow(text)
    if not due:
        # Default to today to ensure it appears in Daily view
        due = datetime.now(timezone.utc)
    title = summarize_task_title(text)
    s = sb()
    ins = s.table("planner_items").insert({
        "user_id": user_id,
        "title": title,
        "status": "todo",
        "priority": "medium",
        "due_date": due.isoformat() if due else None,
        "type": "daily",
    }).execute()
    if getattr(ins, "error", None) or not getattr(ins, "data", None):
        return {"ok": False, "reason": "db_error", "error": str(getattr(ins, "error", None) or "unknown")}
    return {"ok": True, "id": ins.data[0]["id"], "due_date": due.isoformat() if due else None}

def create_task_structured(user_id: str, data: dict) -> dict:
    title = (data.get("title") or "Task").strip()
    due = data.get("dueAt") or data.get("due_date")
    start = data.get("startAt") or data.get("start_date")
    priority = data.get("priority") or "medium"
    s = sb()
    if not due:
        # Default to today to ensure it appears in Daily view when due not provided
        due = datetime.now(timezone.utc).isoformat()
    ins = s.table("planner_items").insert({
        "user_id": user_id,
        "title": title,
        "status": "todo",
        "priority": priority,
        "due_date": due,
        "start_date": start,
        "type": "daily",
    }).execute()
    if getattr(ins, "error", None) or not getattr(ins, "data", None):
        return {"ok": False, "reason": "db_error", "error": str(getattr(ins, "error", None) or "unknown")}
    return {"ok": True, "id": ins.data[0]["id"], "due_date": due}
