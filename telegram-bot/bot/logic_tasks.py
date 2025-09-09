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
