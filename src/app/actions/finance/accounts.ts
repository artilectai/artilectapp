'use server';

import { supabaseServer } from '@/lib/supabase/server';

export type AccountType = 'cash' | 'card' | 'bank' | 'crypto' | 'custom';

export async function createAccount(input: {
  name: string;
  type: AccountType;
  color?: string;
  is_default?: boolean;
  balance?: number;
  currency?: string; // optional - will fallback to profile or 'UZS'
}) {
  const supabase = await supabaseServer();
  const { data: { user }, error: uErr } = await supabase.auth.getUser();
  if (uErr || !user) throw new Error('Not signed in');

  // Fallback: prefer explicit, then user profile currency, else 'UZS'
  let fallbackCurrency = 'UZS';
  try {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('currency')
      .eq('user_id', user.id)
      .maybeSingle();
    if (profile?.currency) fallbackCurrency = profile.currency;
  } catch {}

  // Attempt insert including currency
  const baseRow: any = {
    user_id: user.id,
    name: input.name,
    type: input.type,
    color: input.color,
    is_default: input.is_default,
    balance: input.balance ?? 0
  };
  if (input.currency || fallbackCurrency) {
    baseRow.currency = input.currency || fallbackCurrency;
  }

  let { error } = await supabase.from('finance_accounts').insert(baseRow);

  // If currency column missing (undefined_column = 42703), retry without it
  if (error && (error as any).code === '42703') {
    const retryRow = { ...baseRow };
    delete (retryRow as any).currency;
    const retry = await supabase.from('finance_accounts').insert(retryRow);
    if (retry.error) {
      const e: any = retry.error;
      throw new Error(`createAccount failed (retry): ${e.code || ''} ${e.message}`.trim());
    }
    return;
  }

  if (error) {
    const e: any = error;
    throw new Error(`createAccount failed: ${e.code || ''} ${e.message}`.trim());
  }
}
