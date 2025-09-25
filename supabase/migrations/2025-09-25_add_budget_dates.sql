-- Add start_date and end_date columns to finance_budgets for date-range tracking
alter table public.finance_budgets
  add column if not exists start_date timestamptz,
  add column if not exists end_date timestamptz;

-- Backfill existing rows if empty: set start_date to created_at and derive end_date roughly based on period
DO $$
DECLARE
  r record;
  computed_end timestamptz;
BEGIN
  FOR r IN SELECT id, period, created_at FROM public.finance_budgets WHERE start_date IS NULL LOOP
    IF r.period = 'daily' THEN
      computed_end := r.created_at + interval '1 day';
    ELSIF r.period = 'weekly' THEN
      computed_end := r.created_at + interval '7 days';
    ELSIF r.period = 'monthly' THEN
      computed_end := (r.created_at + interval '1 month');
    ELSIF r.period = 'quarterly' THEN
      computed_end := (r.created_at + interval '3 months');
    ELSIF r.period = 'yearly' THEN
      computed_end := (r.created_at + interval '1 year');
    ELSE
      computed_end := r.created_at + interval '1 month';
    END IF;
    UPDATE public.finance_budgets
      SET start_date = r.created_at, end_date = computed_end
      WHERE id = r.id;
  END LOOP;
END $$;
