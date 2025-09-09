import os, asyncio
from aiogram import Bot, Dispatcher
from dotenv import load_dotenv
from .handlers import router

load_dotenv()
BOT_TOKEN = os.environ["BOT_TOKEN"]

bot = Bot(BOT_TOKEN)
dp = Dispatcher()
dp.include_router(router)

if __name__ == "__main__":
    asyncio.run(dp.start_polling(bot))
