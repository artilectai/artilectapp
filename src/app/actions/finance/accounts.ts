'use server';

import { supabaseServer } from '@/lib/supabase/server';

export type AccountType = 'cash' | 'card' | 'bank' | 'crypto' | 'custom';

export async function createAccount(input: {
  name: string;
  type: AccountType;
  currency?: string;
  color?: string;
  is_default?: boolean;
}) {
  const supabase = await supabaseServer();
  const { data: { user }, error: uErr } = await supabase.auth.getUser();
  if (uErr || !user) throw new Error('Not signed in');

  const { error } = await supabase.from('finance_accounts').insert({
    user_id: user.id,
    currency: 'UZS',
    ...input,
  });
  if (error) throw error;
}
