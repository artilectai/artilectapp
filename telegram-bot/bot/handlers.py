import os, secrets, json
from datetime import datetime, timezone, timedelta
from typing import List, Dict
from aiogram import Router, F
from aiogram.filters import CommandStart, Command
from aiogram.types import Message
from .keyboards import open_app_kb
from .supabase_link import get_user_by_telegram, create_link_code, consume_link_code, validate_init_data
from .nlu import classify_intent
from .logic_finance import insert_transaction
from .logic_finance import insert_transaction_structured
from .logic_tasks import create_task_from_text, create_task_structured
from .openai_client import plan_actions, transcribe_audio

router = Router()

def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()

def _last_week_range():
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=7)
    return start, now

def _fmt_amount(v):
    try:
        return str(int(v))
    except Exception:
        return str(v)

async def _weekly_summary_text(user_id: str) -> str:
    from .supabase_link import sb
    s = sb()
    start, end = _last_week_range()
    # Finance: fetch transactions and categories to map names
    tx = s.table("finance_transactions").select("id,amount,type,currency,category_id,description,occurred_at").eq("user_id", user_id).gte("occurred_at", _iso(start)).lte("occurred_at", _iso(end)).order("occurred_at", desc=True).execute()
    cats = s.table("finance_categories").select("id,name").eq("user_id", user_id).execute()
    cat_map = {c["id"]: c.get("name") for c in (cats.data or [])}
    total_expense = 0
    total_income = 0
    by_cat: dict[str, float] = {}
    currency = None
    for r in (tx.data or []):
        currency = currency or r.get("currency") or ""
        amt = float(r.get("amount") or 0)
        if r.get("type") == "income":
            total_income += amt
        else:
            total_expense += amt
            cname = cat_map.get(r.get("category_id")) or "Other"
            by_cat[cname] = by_cat.get(cname, 0) + amt
    top_cats = sorted(by_cat.items(), key=lambda kv: kv[1], reverse=True)[:3]

    # Tasks: created/done in last week
    tasks = s.table("planner_items").select("id,status,created_at,due_date").eq("user_id", user_id).or_(
        f"created_at.gte.{_iso(start)},due_date.gte.{_iso(start)}"
    ).lte("created_at", _iso(end)).execute()
    created = len(tasks.data or [])
    done = sum(1 for r in (tasks.data or []) if (r.get("status") or "").lower() in ("done","completed"))

    lines = [
        "Last 7 days:",
        f"• Expenses: {_fmt_amount(total_expense)} {currency or ''}",
        f"• Income: {_fmt_amount(total_income)} {currency or ''}",
    ]
    if top_cats:
        lines.append("• Top categories:")
        for name, amt in top_cats:
            lines.append(f"   - {name}: {_fmt_amount(amt)} {currency or ''}")
    lines.append(f"• Tasks created: {created}")
    lines.append(f"• Tasks done: {done}")
    return "\n".join(lines)

@router.message(Command("whoami"))
async def whoami(m: Message):
    from .supabase_link import sb
    user_id = get_user_by_telegram(m.from_user.id)
    if not user_id:
        await m.answer("Not linked. Use /link, then paste the code in the app profile.")
        return
    s = sb()
    try:
        # Count a few rows per table for this user
        tasks = s.table("planner_items").select("id", count="exact").eq("user_id", user_id).execute()
        txs = s.table("finance_transactions").select("id", count="exact").eq("user_id", user_id).execute()
        await m.answer(f"Linked user_id: {user_id}\nplanner_items: {(tasks.count or 0)} rows\nfinance_transactions: {(txs.count or 0)} rows")
    except Exception:
        await m.answer(f"Linked user_id: {user_id}\n(Could not query counts; check bot DB env)")

@router.message(Command("latest"))
async def latest(m: Message):
    from .supabase_link import sb
    user_id = get_user_by_telegram(m.from_user.id)
    if not user_id:
        await m.answer("Not linked. Use /link, then paste the code in the app profile.")
        return
    s = sb()
    try:
        pi = s.table("planner_items").select("id,title,type,due_date,created_at").eq("user_id", user_id).order("created_at", desc=True).limit(3).execute()
        ft = s.table("finance_transactions").select("id,amount,type,currency,description,created_at").eq("user_id", user_id).order("created_at", desc=True).limit(3).execute()
        lines = ["Latest planner_items:"]
        for r in (pi.data or []):
            lines.append(f"• {r.get('id')} | {r.get('title')} | {r.get('type')} | due={r.get('due_date')}")
        lines.append("\nLatest finance_transactions:")
        for r in (ft.data or []):
            sign = '-' if r.get('type')=='expense' else '+'
            lines.append(f"• {r.get('id')} | {sign}{int(r.get('amount',0))} {r.get('currency','')} | {r.get('description','')}")
        await m.answer("\n".join(lines) or "No data yet.")
    except Exception as e:
        await m.answer(f"Failed to fetch latest rows: {e}")

@router.message(Command("week"))
async def week(m: Message):
    user_id = await _ensure_linked(m)
    if not user_id:
        return
    try:
        text = await _weekly_summary_text(user_id)
        await m.answer(text)
    except Exception as e:
        await m.answer("Couldn't fetch weekly summary. Ensure the bot has SUPABASE_SERVICE_ROLE_KEY configured.")

@router.message(Command("diag"))
async def diag(m: Message):
    from .supabase_link import sb, ensure_default_account
    user_id = get_user_by_telegram(m.from_user.id)
    if not user_id:
        await m.answer("Not linked. Use /link, paste code in the app, then try again.")
        return
    s = sb()
    # Check select
    try:
        sel = s.table("planner_items").select("id").eq("user_id", user_id).limit(1).execute()
        sel_ok = not getattr(sel, "error", None)
    except Exception as e:
        sel_ok = False
    # Check insert
    try:
        test = s.table("planner_items").insert({
            "user_id": user_id,
            "title": "_diag",
            "status": "todo",
            "priority": "medium",
            "type": "daily"
        }).execute()
        ins_ok = not getattr(test, "error", None)
        if ins_ok:
            # cleanup
            try:
                tid = test.data[0]["id"]
                s.table("planner_items").delete().eq("id", tid).execute()
            except Exception:
                pass
    except Exception as e:
        ins_ok = False
    await m.answer(f"DB access: select={'ok' if sel_ok else 'fail'}, insert={'ok' if ins_ok else 'fail'}\nIf insert=fail, set SUPABASE_SERVICE_ROLE_KEY for the bot or fix RLS policies.")

@router.message(CommandStart())
async def start(m: Message):
    uid = m.from_user.id
    linked = get_user_by_telegram(uid)
    if linked:
        await m.answer("✅ Linked to your Artilect account. Send me things like:\n• *I spent 25k on food*\n• *Tomorrow I have meeting at 10*",
                       reply_markup=open_app_kb(), parse_mode="Markdown")
    else:
        await m.answer("🔗 Let’s link your Telegram to Artilect.\nUse /link to get a code, then paste it inside the app. Or open the Mini App and it will auto-link.",
                       reply_markup=open_app_kb())

@router.message(Command("link"))
async def link(m: Message):
    code = secrets.token_hex(3)  # 6 hex chars
    create_link_code(code, m.from_user.id)
    await m.answer(f"Your one-time link code: `{code}`\nOpen Artilect → Profile → *Link Telegram* and paste the code.", parse_mode="Markdown")

@router.message(Command("usecode"))
async def usecode(m: Message):
    # Allow: /usecode <code> <user_id> (primarily for debugging)
    parts = m.text.split()
    if len(parts) != 3:
        await m.answer("Usage: /usecode CODE USER_ID")
        return
    ok = consume_link_code(parts[1], parts[2])
    await m.answer("Linked." if ok else "Invalid code.")

@router.message(F.web_app_data)
async def on_web_app_data(m: Message):
    try:
        data = json.loads(m.web_app_data.data)
    except Exception:
        data = {"_raw": m.web_app_data.data}
    # If the Mini App sends initData for auto-link
    if isinstance(data, dict) and data.get("action") == "link" and "initData" in data:
        params = validate_init_data(data["initData"], os.environ["BOT_TOKEN"])
        if not params:
            await m.answer("❌ Could not validate app session.")
            return
        # The initData contains 'user' JSON string with id etc.
        try:
            user_payload = json.loads(params.get("user","{}"))
            tg_id = int(user_payload.get("id"))
        except Exception:
            tg_id = m.from_user.id
        # The app should call your backend to attach the signed user to auth.users.id and then send back the user_id in sendData if needed.
        await m.answer("✅ App session validated. If your account isn't linked yet, paste /link code in your app profile.")
        return

    await m.answer(f"Got data from Mini App: {json.dumps(data)[:1000]}")

async def _ensure_linked(m: Message) -> str | None:
    telegram_id = m.from_user.id
    user_id = get_user_by_telegram(telegram_id)
    if not user_id:
        await m.answer("Please link your account first: /link (then paste the code in the app), or open the Mini App to auto-link.", reply_markup=open_app_kb())
        return None
    return user_id

async def _apply_actions(user_id: str, actions: List[Dict]) -> List[str]:
    from .logic_finance import insert_transaction as insert_tx
    from .logic_tasks import create_task_from_text as create_task
    confirmations: List[str] = []
    debug = bool(os.getenv("BOT_DEBUG"))
    for a in actions or []:
        t = (a.get("type") or a.get("action") or "").lower()
        data = a
        if t in ("add_transaction", "add_income"):
            # Prefer structured when amount provided; fallback to text parsing
            if isinstance(data, dict) and (data.get("amount") is not None):
                payload = dict(data)
                if t == "add_income":
                    payload["type"] = "income"
                else:
                    payload["type"] = payload.get("type") or "expense"
                res = insert_transaction_structured(user_id, payload)
            else:
                txt = data.get("description") or data.get("title") or data.get("text") or ""
                res = insert_tx(user_id, txt)
            if res.get("ok"):
                sign = "-" if res["type"] == "expense" else "+"
                msg = f"Recorded {sign}{int(res['amount'])} {res.get('currency','')} ({res.get('category','')})."
                if debug:
                    msg += f" [tx:{res.get('id')}]"
                confirmations.append(msg)
        elif t == "add_task":
            # Prefer structured if title present
            if isinstance(data, dict) and data.get("title"):
                res = create_task_structured(user_id, data)
            else:
                title = data.get("title") or data.get("text") or "Task"
                res = create_task(user_id, title)
            if res.get("ok"):
                when = res.get("due_date") or ""
                msg = f"Task created. {('Due '+when) if when else ''}".strip()
                if debug:
                    msg += f" [task:{res.get('id')}]"
                confirmations.append(msg)
        elif t == "log_workout":
            # Placeholder: implement concrete workout insertion if needed
            confirmations.append("Workout noted.")
        elif t == "suggest_weekly":
            confirmations.append("Weekly suggestions prepared.")
    return confirmations

@router.message(F.voice)
async def on_voice(m: Message):
    user_id = await _ensure_linked(m)
    if not user_id:
        return
    if not os.getenv("OPENAI_API_KEY"):
        await m.answer("Voice understanding requires OPENAI_API_KEY to be set.")
        return
    # Download voice file and transcribe
    file = await m.bot.get_file(m.voice.file_id)
    bio = await m.bot.download_file(file.file_path)
    audio_bytes = bio.read()
    text = await transcribe_audio(audio_bytes)
    plan = await plan_actions(text, {"userId": user_id})
    confirmations = await _apply_actions(user_id, plan.get("actions", []))
    # Fallback to legacy parsing if no actions were executed
    if not confirmations:
        from .nlu import classify_intent
        intent = classify_intent(text)
        if intent in ("add_expense","add_income"):
            from .logic_finance import insert_transaction
            res = insert_transaction(user_id, text)
            if res.get("ok"):
                sign = "-" if res["type"] == "expense" else "+"
                confirmations.append(f"Recorded {sign}{int(res['amount'])} {res.get('currency','')} ({res.get('category','')}).")
        elif intent == "add_task":
            from .logic_tasks import create_task_from_text
            res = create_task_from_text(user_id, text)
            if res.get("ok"):
                when = res.get("due_date") or ""
                confirmations.append(f"Task created. {('Due '+when) if when else ''}".strip())
    reply = plan.get("reply") or ""
    final = (reply + ("\n" + "\n".join(confirmations) if confirmations else "")).strip()
    await m.answer(final or "Done.")

@router.message(F.photo)
async def on_photo(m: Message):
    user_id = await _ensure_linked(m)
    if not user_id:
        return
    if not os.getenv("OPENAI_API_KEY"):
        await m.answer("Image understanding requires OPENAI_API_KEY to be set.")
        return
    # Highest-res photo
    photo = m.photo[-1]
    file = await m.bot.get_file(photo.file_id)
    bio = await m.bot.download_file(file.file_path)
    img_bytes = bio.read()
    plan = await plan_actions(m.caption or "", {"userId": user_id}, images=[img_bytes])
    confirmations = await _apply_actions(user_id, plan.get("actions", []))
    if not confirmations and m.caption:
        from .nlu import classify_intent
        intent = classify_intent(m.caption)
        if intent in ("add_expense","add_income"):
            from .logic_finance import insert_transaction
            res = insert_transaction(user_id, m.caption)
            if res.get("ok"):
                sign = "-" if res["type"] == "expense" else "+"
                confirmations.append(f"Recorded {sign}{int(res['amount'])} {res.get('currency','')} ({res.get('category','')}).")
        elif intent == "add_task":
            from .logic_tasks import create_task_from_text
            res = create_task_from_text(user_id, m.caption)
            if res.get("ok"):
                when = res.get("due_date") or ""
                confirmations.append(f"Task created. {('Due '+when) if when else ''}".strip())
    reply = plan.get("reply") or ""
    final = (reply + ("\n" + "\n".join(confirmations) if confirmations else "")).strip()
    await m.answer(final or "Processed your image.")

@router.message()
async def any_text(m: Message):
    user_id = await _ensure_linked(m)
    if not user_id:
        return

    txt = m.text or ""
    if os.getenv("OPENAI_API_KEY"):
        plan = await plan_actions(txt, {"userId": user_id})
        confirmations = await _apply_actions(user_id, plan.get("actions", []))
        if confirmations:
            reply = plan.get("reply") or ""
            final = (reply + ("\n" + "\n".join(confirmations) if confirmations else "")).strip()
            await m.answer(final or "Done.")
            return
        # Fallback to legacy intent if no actions were executed
        # Continues below to legacy branch

    # Legacy fallback (regex intent)
    low = txt.lower()
    if any(k in low for k in ["last week","past week","last 7 days","past 7 days","за прошлую неделю","прошлой неделе","за неделю"]):
        try:
            weekly = await _weekly_summary_text(user_id)
            await m.answer(weekly)
            return
        except Exception:
            await m.answer("Couldn't fetch weekly summary. Ensure SUPABASE_SERVICE_ROLE_KEY is set for the bot.")
            return
    intent = classify_intent(txt)
    if intent in ("add_expense","add_income"):
        res = insert_transaction(user_id, txt)
        if res.get("ok"):
            sign = "-" if res["type"] == "expense" else "+"
            await m.answer(f"Recorded {sign}{int(res['amount'])} {res.get('currency','')} ({res.get('category','')}).")
        else:
            if res.get("reason") == "amount_not_found":
                await m.answer("I couldn't find the amount. Try: *I spent 25 000 on food*", parse_mode="Markdown")
            else:
                await m.answer("Couldn't save the transaction. Please try again later.")
        return
    if intent == "add_task":
        res = create_task_from_text(user_id, txt)
        if res.get("ok"):
            when = res.get("due_date","")
            await m.answer(f"Task created. {('Due '+when) if when else ''}".strip())
        else:
            if res.get("reason") == "db_error":
                await m.answer("Couldn't save the task (DB). Please set SUPABASE_SERVICE_ROLE_KEY for the bot or check RLS.")
            else:
                await m.answer("Couldn't create a task, please try again.")
        return
    await m.answer(
        "Tell me things like:\n• *I spent 25k on food*\n• *Add income 1200 salary*\n• *Tomorrow I have meeting at 10*",
        parse_mode="Markdown",
    )
