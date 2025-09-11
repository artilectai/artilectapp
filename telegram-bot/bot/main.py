import os, asyncio
from dotenv import load_dotenv, find_dotenv

# Load .env BEFORE importing modules that access env at import time
if not load_dotenv(find_dotenv(filename=".env", raise_error_if_not_found=False)):
    # Fallback to .env.example for local runs if .env is not present
    load_dotenv(find_dotenv(filename=".env.example", raise_error_if_not_found=False))

from aiogram import Bot, Dispatcher
from .handlers import router

BOT_TOKEN = os.environ.get("BOT_TOKEN")
if not BOT_TOKEN:
    raise RuntimeError("BOT_TOKEN is not set. Add it to telegram-bot/.env or your environment.")

bot = Bot(BOT_TOKEN)
dp = Dispatcher()
dp.include_router(router)

async def main():
    # Ensure webhook is removed when using polling, otherwise Telegram won't deliver updates via getUpdates
    try:
        await bot.delete_webhook(drop_pending_updates=False)
    except Exception:
        pass
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
