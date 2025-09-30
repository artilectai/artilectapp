'use server';

import { supabaseServer } from '@/lib/supabase/server';

export type AccountType = 'cash' | 'card' | 'bank' | 'crypto' | 'custom';

export async function createAccount(input: {
  name: string;
  type: AccountType;
  color?: string;
  is_default?: boolean;
  balance?: number;
  currency: string; // NEW per-account currency
}) {
  const supabase = await supabaseServer();
  const { data: { user }, error: uErr } = await supabase.auth.getUser();
  if (uErr || !user) throw new Error('Not signed in');

  const { error } = await supabase.from('finance_accounts').insert({
    user_id: user.id,
    name: input.name,
    type: input.type,
    color: input.color,
    is_default: input.is_default,
    balance: input.balance ?? 0,
    currency: input.currency || 'UZS'
  });
  if (error) throw error;
}
