import os, secrets, json
from aiogram import Router, F
from aiogram.filters import CommandStart, Command
from aiogram.types import Message
from .keyboards import open_app_kb
from .supabase_link import get_user_by_telegram, create_link_code, consume_link_code, validate_init_data
from .nlu import classify_intent
from .logic_finance import insert_transaction
from .logic_tasks import create_task_from_text

router = Router()

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

@router.message()
async def any_text(m: Message):
    telegram_id = m.from_user.id
    user_id = get_user_by_telegram(telegram_id)
    if not user_id:
        await m.answer("Please link your account first: /link (then paste the code in the app), or open the Mini App to auto-link.", reply_markup=open_app_kb())
        return

    txt = m.text or ""
    intent = classify_intent(txt)
    if intent in ("add_expense","add_income"):
        res = insert_transaction(user_id, txt)
        if res.get("ok"):
            sign = "-" if res["type"] == "expense" else "+"
            await m.answer(f"Recorded {sign}{int(res['amount'])} {res.get('currency','')} ({res.get('category','')}).")
        else:
            await m.answer("I couldn't find the amount. Try: *I spent 25 000 on food*", parse_mode="Markdown")
        return

    if intent == "add_task":
        res = create_task_from_text(user_id, txt)
        if res.get("ok"):
            when = res.get("due_date","")
            await m.answer(f"Task created. {('Due '+when) if when else ''}".strip())
        else:
            await m.answer("Couldn't create a task, please try again.")
        return

    await m.answer("Tell me things like:\n• *I spent 25k on food*\n• *Add income 1200 salary*\n• *Tomorrow I have meeting at 10*",
                   parse_mode="Markdown")
