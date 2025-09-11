import os
from fastapi import FastAPI, Request, Header, HTTPException
from aiogram import Bot, Dispatcher
from aiogram.types import Update
from dotenv import load_dotenv

# Load env before imports that use it
load_dotenv()
from .handlers import router

BOT_TOKEN = os.environ.get("BOT_TOKEN")
if not BOT_TOKEN:
    raise RuntimeError("BOT_TOKEN is not set. Add it to env on your server.")
WEBHOOK_URL = os.environ.get("WEBHOOK_URL")
WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "")
WEBHOOK_PATH = os.getenv("WEBHOOK_PATH", "/webhook")
if not WEBHOOK_URL:
    raise RuntimeError("WEBHOOK_URL is not set. Set it to your public https URL (e.g., https://host/telegram/webhook/secret).")

bot = Bot(BOT_TOKEN)
dp = Dispatcher()
dp.include_router(router)

app = FastAPI()

@app.on_event("startup")
async def _startup():
    await bot.set_webhook(WEBHOOK_URL, secret_token=WEBHOOK_SECRET or None, drop_pending_updates=True)

@app.on_event("shutdown")
async def _shutdown():
    await bot.delete_webhook()

@app.post(path=WEBHOOK_PATH)
async def webhook(request: Request, x_telegram_bot_api_secret_token: str | None = Header(default=None)):
    # Optional header check for Telegram secret token
    if WEBHOOK_SECRET and (x_telegram_bot_api_secret_token or "") != WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="invalid token")
    data = await request.json()
    await dp.feed_update(bot, Update.model_validate(data))
    return {"ok": True}

@app.get("/healthz")
async def healthz():
    return {"ok": True}
