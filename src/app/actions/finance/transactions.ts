'use server';

import { supabaseServer } from '@/lib/supabase/server';

export type TransactionType = 'income' | 'expense' | 'transfer';

export async function addTransaction(input: {
  account_id: string;
  category_id?: string | null;
  type: TransactionType;
  amount: number;
  currency?: string;
  description?: string;
  tags?: string[];
  occurred_at?: string; // ISO
}) {
  const supabase = await supabaseServer();
  const { data: { user }, error: uErr } = await supabase.auth.getUser();
  if (uErr || !user) throw new Error('Not signed in');

  const { error } = await supabase.from('finance_transactions').insert({
    user_id: user.id,
    currency: 'UZS',
    ...input,
  });
  if (error) throw error;
}
