import os, asyncio, json, base64
from typing import Any, Dict, List, Optional, Union
from openai import OpenAI

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# System prompt that turns the model into a proactive personal assistant.
SYSTEM_PROMPT = (
    "You are Artilect, a personal assistant that manages the user's life across finance, tasks, and workouts.\n"
    "Inputs can be text, voice (as transcript), and images (e.g., receipts, screenshots).\n"
    "You are provided with UserContext (profile, timezone, currency, recent transactions, tasks, workouts) and must output actions to apply, then a short human reply.\n\n"
    "Rules:\n"
    "- Always produce strict JSON with keys: actions (array), reply (string).\n"
    "- Each action is one of: add_transaction, add_income, add_task, log_workout, suggest_weekly, none.\n"
    "- Use the user's timezone for dates like 'today', 'tomorrow'. If no date is supplied, default to 'today' for transactions, and next reasonable date/time for tasks.\n"
    "- Prefer the user's currency from context; if an amount has a currency symbol/word, respect it.\n"
    "- Categories: map to likely category names; if uncertain, pick a sensible default and include a 'category_guess': true.\n"
    "- For images: extract useful details (merchant, total, date, category hints). For voice: treat transcript as the message.\n"
    "- If essential details are missing, ask one concise follow-up in 'reply' and emit action 'none'.\n"
    "- Keep 'reply' short and actionable, confirming what was logged/created.\n\n"
    "Action schemas (camelCase keys):\n"
    "- add_transaction: { type: 'expense', amount: number, currency?: string, category?: string, description?: string, occurredAt?: string (ISO), tags?: string[] }\n"
    "- add_income: { amount: number, currency?: string, source?: string, occurredAt?: string (ISO), tags?: string[] }\n"
    "- add_task: { title: string, dueAt?: string (ISO), startAt?: string (ISO), priority?: 'low'|'normal'|'high', tags?: string[] }\n"
    "- log_workout: { sport?: string, durationMin?: number, intensity?: 'low'|'moderate'|'high', occurredAt?: string (ISO), notes?: string }\n"
    "- suggest_weekly: { scope?: 'finance'|'tasks'|'workout'|'all' }\n"
)

def _image_content_items(images: Optional[List[Union[str, bytes]]]) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    if not images:
        return items
    for img in images:
        if isinstance(img, bytes):
            b64 = base64.b64encode(img).decode("utf-8")
            items.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/png;base64,{b64}"}
            })
        elif isinstance(img, str):
            # Treat as URL or data URL
            items.append({
                "type": "image_url",
                "image_url": {"url": img}
            })
    return items

async def complete(prompt: str) -> str:
    """Legacy helper returning a free-form answer using the new assistant persona."""
    def _call():
        resp = client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
        )
        return resp.choices[0].message.content or ""
    return await asyncio.to_thread(_call)

async def plan_actions(
    user_input: str,
    user_context: Optional[Dict[str, Any]] = None,
    images: Optional[List[Union[str, bytes]]] = None,
) -> Dict[str, Any]:
    """
    Produce a structured plan from user input and optional images.
    Returns a dict with shape: { actions: Action[], reply: string }.
    """
    user_context = user_context or {}

    # Build a multimodal user message: JSON context + text + optional images
    user_content: List[Dict[str, Any]] = [
        {"type": "text", "text": json.dumps({
            "UserContext": user_context,
            "Message": user_input
        }, ensure_ascii=False)}
    ]
    user_content.extend(_image_content_items(images))

    def _call():
        resp = client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            temperature=0,
            response_format={"type": "json_object"}
        )
        raw = resp.choices[0].message.content or "{}"
        try:
            return json.loads(raw)
        except Exception:
            # Fallback: wrap as a minimal contract
            return {"actions": [], "reply": raw}

    return await asyncio.to_thread(_call)

async def transcribe_audio(path_or_bytes: Union[str, bytes]) -> str:
    """Transcribe voice messages. Supports a file path or raw bytes. Uses Whisper-1 by default."""
    model = os.getenv("OPENAI_TRANSCRIBE_MODEL", "whisper-1")

    def _call_from_path(p: str) -> str:
        with open(p, "rb") as f:
            tr = client.audio.transcriptions.create(model=model, file=f)
        # SDK returns an object with .text
        return getattr(tr, "text", "") or ""

    def _call_from_bytes(b: bytes) -> str:
        import io
        f = io.BytesIO(b)
        f.name = "audio.ogg"  # Telegram voice default; server will infer
        tr = client.audio.transcriptions.create(model=model, file=f)
        return getattr(tr, "text", "") or ""

    if isinstance(path_or_bytes, bytes):
        return await asyncio.to_thread(_call_from_bytes, path_or_bytes)
    return await asyncio.to_thread(_call_from_path, path_or_bytes)
