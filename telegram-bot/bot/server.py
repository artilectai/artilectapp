import os, logging
from urllib.parse import urlparse
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
# Derive webhook path from URL if not explicitly provided
_derived_path = ""
try:
    if WEBHOOK_URL:
        _derived_path = urlparse(WEBHOOK_URL).path or ""
except Exception:
    _derived_path = ""
WEBHOOK_PATH = os.getenv("WEBHOOK_PATH", _derived_path or "/webhook")
if not WEBHOOK_URL:
    raise RuntimeError("WEBHOOK_URL is not set. Set it to your public https URL (e.g., https://host/telegram/webhook/secret).")

bot = Bot(BOT_TOKEN)
dp = Dispatcher()
dp.include_router(router)

app = FastAPI()

@app.on_event("startup")
async def _startup():
    logging.info(f"Setting Telegram webhook to: {WEBHOOK_URL}")
    logging.info(f"Webhook path configured: {WEBHOOK_PATH} (derived from URL if not set explicitly)")
    await bot.set_webhook(WEBHOOK_URL, secret_token=WEBHOOK_SECRET or None, drop_pending_updates=True)
    try:
        info = await bot.get_webhook_info()
        logging.info(
            "WebhookInfo: url=%s, pending=%s, last_error_date=%s, last_error_message=%s",
            getattr(info, "url", None), getattr(info, "pending_update_count", None),
            getattr(info, "last_error_date", None), getattr(info, "last_error_message", None),
        )
    except Exception as e:
        logging.warning("Failed to fetch webhook info: %s", e)

@app.on_event("shutdown")
async def _shutdown():
    await bot.delete_webhook()

@app.get("/")
async def root():
    return {"ok": True, "service": "artilect-bot", "webhook_path": WEBHOOK_PATH}

@app.head("/")
async def root_head():
    # For platforms issuing HEAD health checks
    return {}

@app.post(path=WEBHOOK_PATH)
async def webhook(request: Request, x_telegram_bot_api_secret_token: str | None = Header(default=None)):
    # Optional header check for Telegram secret token
    logging.info("Webhook hit: validating secret header")
    if WEBHOOK_SECRET and (x_telegram_bot_api_secret_token or "") != WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="invalid token")
    data = await request.json()
    logging.info("Webhook update received; forwarding to dispatcher")
    await dp.feed_update(bot, Update.model_validate(data))
    return {"ok": True}

@app.get("/healthz")
async def healthz():
    return {"ok": True}

@app.get("/debug/webhook")
async def debug_webhook():
    try:
        info = await bot.get_webhook_info()
        return {
            "ok": True,
            "url": getattr(info, "url", None),
            "has_custom_certificate": getattr(info, "has_custom_certificate", None),
            "pending_update_count": getattr(info, "pending_update_count", None),
            "ip_address": getattr(info, "ip_address", None),
            "last_error_date": getattr(info, "last_error_date", None),
            "last_error_message": getattr(info, "last_error_message", None),
            "max_connections": getattr(info, "max_connections", None),
            "allowed_updates": getattr(info, "allowed_updates", None),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
