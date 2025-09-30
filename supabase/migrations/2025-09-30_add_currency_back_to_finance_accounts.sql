-- Migration: Re-add currency column to finance_accounts for per-account currencies
-- Date: 2025-09-30
-- Safe / idempotent style

-- 1) Add currency column if missing (default 'UZS')
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'finance_accounts' and column_name = 'currency'
  ) then
    alter table public.finance_accounts add column currency text;
    alter table public.finance_accounts alter column currency set default 'UZS';
    update public.finance_accounts set currency = 'UZS' where currency is null; -- backfill
    alter table public.finance_accounts alter column currency set not null;
  end if;
end $$;

-- 2) (Optional) future: consider constraint to limit to known ISO set; skipped for flexibility

-- 3) COMMENT for clarity
comment on column public.finance_accounts.currency is 'Per-account currency code (e.g., UZS, USD, EUR, RUB). Added back for multi-currency bookkeeping.';
