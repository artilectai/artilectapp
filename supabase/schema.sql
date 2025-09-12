-- Create tables matching the app usage (public schema)

-- Users come from Supabase Auth, but we’ll store per-user rows by user_id (UUID)

-- UUID generation for primary keys
create extension if not exists pgcrypto;

-- User profiles (mirror of BetterAuth users)
create table if not exists public.user_profiles (
  user_id uuid primary key,
  email text,
  name text,
  phone text,
  -- First-time experience flags (account-scoped, not device/Telegram)
  onboarding_completed boolean not null default false,
  onboarding_completed_at timestamptz,
  finance_setup_completed boolean not null default false,
  workout_setup_completed boolean not null default false,
  -- User preferences moved from localStorage
  app_theme text not null default 'dark',
  app_timezone text not null default 'UTC',
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- If the table already existed, ensure new preference columns are present
alter table if exists public.user_profiles 
  add column if not exists app_theme text not null default 'dark';
alter table if exists public.user_profiles 
  add column if not exists app_timezone text not null default 'UTC';
alter table if exists public.user_profiles 
  add column if not exists currency text not null default 'USD';

-- Unified planner_items replaces prior tasks and planner_goals tables
-- Safe to re-run: drops old tables if they still exist, then defines the unified table
drop table if exists public.planner_goals cascade;
drop table if exists public.tasks cascade;

create table if not exists public.planner_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  -- Common
  title text not null,
  description text,
  status text not null default 'todo' check (
    status in (
      'todo','doing','done','skipped',      -- task-like
      'planning','in_progress','completed','paused' -- goal-like
    )
  ),
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  -- Period type for both tasks and goals
  type text not null check (type in ('daily','weekly','monthly','yearly')),
  -- Dates
  start_date timestamptz,
  due_date timestamptz,
  target_date timestamptz, -- used by weekly/monthly/yearly items
  completed_at timestamptz,
  -- Task-like fields
  estimate_hours int,
  tags text[],
  checklist jsonb not null default '[]'::jsonb,
  -- Goal-like fields
  milestones jsonb not null default '[]'::jsonb,
  progress int not null default 0,
  -- Audit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  type text not null,
  balance numeric not null default 0,
  color text not null default '#10B981',
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- Subscriptions stored by authenticated user, email and phone
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text not null,
  phone text,
  plan text not null check (plan in ('lite','pro')),
  status text not null default 'active' check (status in ('active','canceled','expired')),
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One active subscription row per user (latest row wins on conflict)
create unique index if not exists subscriptions_user_unique on public.subscriptions(user_id);
create index if not exists subscriptions_email_idx on public.subscriptions(email);
create index if not exists subscriptions_phone_idx on public.subscriptions(phone);

create table if not exists public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  type text not null,
  color text
);

create table if not exists public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  account_id uuid not null references public.finance_accounts(id) on delete cascade,
  category_id uuid references public.finance_categories(id),
  type text not null check (type in ('income','expense','transfer')),
  amount numeric not null,
  currency text not null default 'UZS',
  description text,
  tags text[],
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Budgets (previously in localStorage)
create table if not exists public.finance_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  category text not null,
  limit_amount numeric not null,
  spent numeric not null default 0,
  currency text not null default 'UZS',
  period text not null check (period in ('daily','weekly','monthly','quarterly','yearly')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Financial goals (previously in localStorage)
create table if not exists public.finance_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  target_amount numeric not null,
  current_amount numeric not null default 0,
  deadline timestamptz not null,
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workout_programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  sport_type text not null,
  frequency int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  program_id uuid references public.workout_programs(id) on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_min int,
  calories int,
  notes text,
  created_at timestamptz not null default now()
);

-- Planner goals (weekly/monthly/yearly)
-- Optional indexes for performance
create index if not exists planner_items_user_idx on public.planner_items(user_id);
create index if not exists planner_items_type_idx on public.planner_items(type);
create index if not exists planner_items_created_idx on public.planner_items(created_at desc);

-- Ensure new columns exist when re-running on an existing database
alter table if exists public.planner_items
  add column if not exists checklist jsonb not null default '[]'::jsonb;

-- RLS
alter table public.planner_items enable row level security;
alter table public.user_profiles enable row level security;
alter table public.finance_accounts enable row level security;
alter table public.finance_categories enable row level security;
alter table public.finance_transactions enable row level security;
alter table public.finance_budgets enable row level security;
alter table public.finance_goals enable row level security;
alter table public.workout_programs enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.subscriptions enable row level security;
-- Old tables were dropped above; ensure no lingering RLS from previous runs

-- Policies: users can CRUD own rows
-- Unified planner_items policies: CRUD own rows
create policy if not exists pi_select on public.planner_items for select using (auth.uid() = user_id);
-- user_profiles: each user can read and upsert their own row
create policy up_select on public.user_profiles for select using (auth.uid() = user_id);
create policy up_insert on public.user_profiles for insert with check (auth.uid() = user_id);
create policy up_update on public.user_profiles for update using (auth.uid() = user_id);
create policy if not exists pi_insert on public.planner_items for insert with check (auth.uid() = user_id);
create policy if not exists pi_update on public.planner_items for update using (auth.uid() = user_id);
create policy if not exists pi_delete on public.planner_items for delete using (auth.uid() = user_id);

create policy fa_select on public.finance_accounts for select using (auth.uid() = user_id);
create policy fa_insert on public.finance_accounts for insert with check (auth.uid() = user_id);
create policy fa_update on public.finance_accounts for update using (auth.uid() = user_id);
create policy fa_delete on public.finance_accounts for delete using (auth.uid() = user_id);

create policy fc_select on public.finance_categories for select using (auth.uid() = user_id);
create policy fc_insert on public.finance_categories for insert with check (auth.uid() = user_id);
create policy fc_update on public.finance_categories for update using (auth.uid() = user_id);
create policy fc_delete on public.finance_categories for delete using (auth.uid() = user_id);

create policy ft_select on public.finance_transactions for select using (auth.uid() = user_id);
create policy ft_insert on public.finance_transactions for insert with check (auth.uid() = user_id);
create policy ft_update on public.finance_transactions for update using (auth.uid() = user_id);
create policy ft_delete on public.finance_transactions for delete using (auth.uid() = user_id);

create policy fb_select on public.finance_budgets for select using (auth.uid() = user_id);
create policy fb_insert on public.finance_budgets for insert with check (auth.uid() = user_id);
create policy fb_update on public.finance_budgets for update using (auth.uid() = user_id);
create policy fb_delete on public.finance_budgets for delete using (auth.uid() = user_id);

create policy fg_select on public.finance_goals for select using (auth.uid() = user_id);
create policy fg_insert on public.finance_goals for insert with check (auth.uid() = user_id);
create policy fg_update on public.finance_goals for update using (auth.uid() = user_id);
create policy fg_delete on public.finance_goals for delete using (auth.uid() = user_id);

create policy wp_select on public.workout_programs for select using (auth.uid() = user_id);
create policy wp_insert on public.workout_programs for insert with check (auth.uid() = user_id);
create policy wp_update on public.workout_programs for update using (auth.uid() = user_id);
create policy wp_delete on public.workout_programs for delete using (auth.uid() = user_id);

create policy ws_select on public.workout_sessions for select using (auth.uid() = user_id);
create policy ws_insert on public.workout_sessions for insert with check (auth.uid() = user_id);
create policy ws_update on public.workout_sessions for update using (auth.uid() = user_id);
create policy ws_delete on public.workout_sessions for delete using (auth.uid() = user_id);

-- Planner goals policies: CRUD own rows
-- Remove legacy policies if present (safe no-op if they don't exist)
drop policy if exists tasks_select on public.tasks;
drop policy if exists tasks_insert on public.tasks;
drop policy if exists tasks_update on public.tasks;
drop policy if exists tasks_delete on public.tasks;
drop policy if exists pg_select on public.planner_goals;
drop policy if exists pg_insert on public.planner_goals;
drop policy if exists pg_update on public.planner_goals;
drop policy if exists pg_delete on public.planner_goals;

-- Subscriptions: users can only access and manage their own subscription
create policy subs_select on public.subscriptions for select using (auth.uid() = user_id);
create policy subs_insert on public.subscriptions for insert with check (auth.uid() = user_id);
create policy subs_update on public.subscriptions for update using (auth.uid() = user_id);
create policy subs_delete on public.subscriptions for delete using (auth.uid() = user_id);

-- Realtime
-- In Supabase Dashboard -> Database -> Replication, enable "postgres_changes" for these tables under the public schema.
