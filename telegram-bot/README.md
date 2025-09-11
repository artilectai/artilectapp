# Artilect Telegram Bot

Production-ready Python bot (aiogram v3) that links Telegram users to your Artilect Assistant app (Supabase),
logs finance transactions from natural language, creates tasks from messages, and opens your Mini App.

## Features
- **Linking**: map `telegram_user_id` ↔️ `auth.users.id` via `/link` code or WebApp `initData` (secure HMAC).
- **Finance**: "i spent 25k on food" → inserts into `finance_transactions` (and auto-creates a default account if missing).
- **Tasks**: "tomorrow i have meeting at 10" → creates a `tasks` row with due/start times.
- **Mini App Button**: Inline **Open Artilect** button; supports receiving `sendData` payload back into the bot.
- **Webhook & Polling**: `bot/main.py` (polling dev) and `bot/server.py` (FastAPI webhook for prod).

## Setup
1) Create a Telegram bot with @BotFather → set `BOT_TOKEN` in `.env`.
2) Fill `.env` with your Supabase keys and URLs.
3) (Optional) Run the migration below to create linking tables.

## Supabase: Minimal Tables
Execute this SQL in Supabase (SQL editor):

```sql
-- 1) Map Telegram to users
create table if not exists public.telegram_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  telegram_user_id bigint not null unique,
  created_at timestamptz not null default now()
);

-- 2) Optional ephemeral linking codes
create table if not exists public.telegram_link_codes (
  code text primary key,
  telegram_user_id bigint not null,
  created_at timestamptz not null default now(),
  consumed_by uuid null references auth.users(id) on delete set null
);
create index if not exists idx_tlc_created_at on public.telegram_link_codes(created_at);

-- Finance & tasks tables are already in your app:
-- finance_accounts(user_id uuid, name text, type text, color text, is_default bool, created_at timestamptz default now())
-- finance_transactions(user_id uuid, account_id uuid, category_id uuid null, type text, amount numeric, currency text default 'UZS', description text, tags text[], occurred_at timestamptz default now(), created_at timestamptz default now())
-- finance_categories(user_id uuid, name text, type text, color text)
-- tasks(id uuid default gen_random_uuid() primary key, user_id uuid, title text, status text, priority text, start_date date, due_date timestamptz, estimate_hours numeric, tags text[], completed_at timestamptz, created_at timestamptz default now())
```

> If you prefer to store the Telegram ID directly on `public.profiles`, add a `telegram_user_id bigint unique` column and update the code in `supabase_link.py` accordingly.

## Run (dev / polling)
```bash
cp .env.example .env  # fill it
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
python -m bot.main
```

## Run (prod / webhook)
Vercel does not run Python processes. Deploy this folder to a Python-friendly host:

Option A: Docker
```bash
docker build -t artilect-bot:latest telegram-bot
docker run -p 8080:8080 \
  -e BOT_TOKEN=$BOT_TOKEN \
  -e NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
  -e WEBHOOK_URL=$WEBHOOK_URL -e WEBHOOK_PATH=$WEBHOOK_PATH -e WEBHOOK_SECRET=$WEBHOOK_SECRET \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  artilect-bot:latest
```

Option B: Uvicorn directly (VM/host)
```bash
pip install -r requirements.txt
uvicorn bot.server:app --host 0.0.0.0 --port 8080
```

On startup the app sets the webhook to `WEBHOOK_URL`. Verify with @BotFather → getWebhookInfo or via Telegram API.

## Mini App handshake
- The bot sends a button that opens `WEBAPP_URL`.
- Inside your Mini App, call `Telegram.WebApp.sendData(JSON.stringify({action:'link', initData: Telegram.WebApp.initData}))` once loaded.
- The bot validates `initData` HMAC and upserts `telegram_links` for the signed user.

## NLU: Examples
- "i spent 25k on food" → expense amount 25000, category 'food' (mapped to 'Groceries' if found).
- "add income 1200 salary" → income 1200, category 'salary'.
- "tomorrow i have meeting at 10" → task with `due_date` tomorrow at 10:00 local time.

## File Map
- `bot/main.py`        → polling entry
- `bot/server.py`      → FastAPI webhook entry
- `bot/keyboards.py`   → inline keyboards (Open Artilect button)
- `bot/openai_client.py`→ optional OpenAI call helper
- `bot/nlu.py`         → lightweight parsers for finance and tasks
- `bot/supabase_link.py`→ link helpers (find user by Telegram ID, /link codes, WebApp initData validation)
- `bot/logic_finance.py`→ insert transaction/helpers
- `bot/logic_tasks.py`  → create task/helpers
- `bot/handlers.py`     → aiogram handlers
- `bot/utils.py`        → misc utils (time zone, parsing)
- `migrations.sql`      → the SQL above (duplicate for convenience)
```
