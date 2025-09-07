"use client";

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { addTransaction } from '@/app/actions/finance/transactions';

type Tx = {
  id: string;
  account_id: string;
  category_id?: string | null;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  currency?: string | null;
  description?: string | null;
  tags?: string[] | null;
  occurred_at?: string | null;
  created_at?: string | null;
};

export default function TransactionsPage() {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const { data, error } = await supabase
      .from('finance_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      setError(error.message);
      setTxs([]);
    } else {
      setTxs((data as Tx[]) || []);
    }
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel('finance-transactions-rt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'finance_transactions' },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const handleAdd = async () => {
    try {
      setLoading(true);
      // Pick the first account for demo
      const { data: accounts } = await supabase.from('finance_accounts').select('id').limit(1);
      const accountId = accounts?.[0]?.id as string | undefined;
      if (!accountId) {
        setError('No accounts found. Create one first.');
        setLoading(false);
        return;
      }
      await addTransaction({ account_id: accountId, type: 'expense', amount: 10000, description: 'Sample expense' });
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to add transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={handleAdd}
          disabled={loading}
          className="px-3 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? 'Adding…' : 'Add transaction'}
        </button>
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
      <ul className="space-y-2">
        {txs.map(tx => (
          <li key={tx.id} className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">{tx.type}</span>
            <span className={tx.type === 'income' ? 'text-emerald-600' : tx.type === 'expense' ? 'text-red-600' : 'text-blue-600'}>
              {tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''}{tx.amount} {tx.currency || 'UZS'}
            </span>
            {tx.description ? <span className="text-sm">• {tx.description}</span> : null}
            {tx.occurred_at ? <span className="text-xs text-muted-foreground">• {new Date(tx.occurred_at).toLocaleString()}</span> : null}
          </li>
        ))}
        {txs.length === 0 && <li className="text-muted-foreground">No transactions yet</li>}
      </ul>
    </div>
  );
}
