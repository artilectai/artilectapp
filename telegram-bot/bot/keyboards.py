import os
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

WEBAPP_URL = os.getenv("WEBAPP_URL") or os.getenv("WEBHOOK_URL") or ""
if not WEBAPP_URL:
    # Fallback to avoid broken buttons; button will still render but not open anything meaningful
    WEBAPP_URL = "https://google.com"

BOT_USERNAME = os.getenv("BOT_USERNAME", "artilectai_bot").lstrip("@")

def open_app_kb() -> InlineKeyboardMarkup:
        """
        Provide two open options:
            1) web_app button for classic Mini App (may open as a sheet inside chats)
            2) direct deep link which opens full-screen by default: t.me/<bot>?startapp=...
        """
        deep_link = f"https://t.me/{BOT_USERNAME}?startapp=start"
    # Prefer the full-screen deep link first; keep mini-app sheet as secondary option
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="Open Artilect", url=deep_link)],
        [InlineKeyboardButton(text="Open inside chat", web_app=WebAppInfo(url=WEBAPP_URL))],
    ])
