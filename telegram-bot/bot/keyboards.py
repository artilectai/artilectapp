import os
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

WEBAPP_URL = os.getenv("WEBAPP_URL","https://example.com")

def open_app_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="Open Artilect", web_app=WebAppInfo(url=WEBAPP_URL))
    ]])
