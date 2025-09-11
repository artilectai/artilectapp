import os
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

WEBAPP_URL = os.getenv("WEBAPP_URL") or os.getenv("WEBHOOK_URL") or ""
if not WEBAPP_URL:
    # Fallback to avoid broken buttons; button will still render but not open anything meaningful
    WEBAPP_URL = "https://google.com"

def open_app_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="Open Artilect", web_app=WebAppInfo(url=WEBAPP_URL))
    ]])
