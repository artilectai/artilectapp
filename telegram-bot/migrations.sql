-- See README for explanations
create table if not exists public.telegram_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  telegram_user_id bigint not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.telegram_link_codes (
  code text primary key,
  telegram_user_id bigint not null,
  created_at timestamptz not null default now(),
  consumed_by uuid null references auth.users(id) on delete set null
);
create index if not exists idx_tlc_created_at on public.telegram_link_codes(created_at);
