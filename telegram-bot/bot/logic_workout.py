from .supabase_link import sb

def log_workout(user_id: str, data: dict) -> dict:
    sport = data.get("sport") or data.get("sportType") or "workout"
    duration = data.get("durationMin")
    intensity = data.get("intensity")
    occurred_at = data.get("occurredAt")
    s = sb()
    ins = s.table("workout_sessions").insert({
        "user_id": user_id,
        "sport_type": sport,
        "duration_min": duration,
        "intensity": intensity,
        "occurred_at": occurred_at,
        "notes": data.get("notes")
    }).execute()
    return {"ok": True, "id": ins.data[0]["id"]}
