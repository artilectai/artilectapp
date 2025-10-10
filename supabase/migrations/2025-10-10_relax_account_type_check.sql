-- Migration: Relax finance account type check to allow custom types
-- Date: 2025-10-10
-- Purpose: Permit arbitrary account type strings beyond ('cash','card','bank','crypto')

-- 1) Drop existing check constraint if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'finance_accounts' AND c.conname = 'finance_accounts_type_check'
  ) THEN
    ALTER TABLE public.finance_accounts DROP CONSTRAINT finance_accounts_type_check;
  END IF;
END $$;

-- 2) Optionally add a looser constraint (non-empty text) – comment out if you want no constraint at all
-- ALTER TABLE public.finance_accounts
--   ADD CONSTRAINT finance_accounts_type_nonempty_check CHECK (char_length(trim(type)) > 0);

-- 3) Document change
COMMENT ON TABLE public.finance_accounts IS 'Accounts table; type is free-form text to support custom types defined by users.';
