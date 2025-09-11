-- Migration: Remove currency from finance_accounts (use user_profiles.currency instead)
-- Safe, idempotent operations where possible

-- 1) Ensure user_profiles has nullable currency (authoritative source)
alter table if exists public.user_profiles alter column currency drop not null;
alter table if exists public.user_profiles alter column currency drop default;

-- 2) Backfill finance_transactions.currency from user_profiles for recent rows that still have NULL or empty
update public.finance_transactions ft
set currency = coalesce(up.currency, ft.currency)
from public.user_profiles up
where ft.user_id = up.user_id
  and (ft.currency is null or ft.currency = '')
;

-- 3) Drop currency column from finance_accounts (only if exists)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'finance_accounts' and column_name = 'currency'
  ) then
    alter table public.finance_accounts drop column currency;
  end if;
end $$;

-- 4) Optional: tighten RLS policies remain unchanged; no currency constraints needed here

-- 5) Notes:
--    - The app now formats and posts currency using user_profiles.currency.
--    - Accounts are currency-agnostic; transactions keep their own currency for historical accuracy.
