"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { createAccount } from '@/app/actions/finance/accounts';

type Account = {
  id: string;
  name: string;
  type: 'cash' | 'card' | 'bank' | 'crypto' | 'custom';
  currency?: string | null;
  color?: string | null;
  is_default?: boolean | null;
  created_at?: string;
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const { data, error } = await supabase
      .from('finance_accounts')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      setError(error.message);
      setAccounts([]);
    } else {
      setAccounts((data as Account[]) || []);
    }
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel('finance-accounts-rt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'finance_accounts' },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const handleCreate = async () => {
    try {
      setLoading(true);
      await createAccount({ name: 'Wallet', type: 'cash', color: '#10b981' });
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={handleCreate}
          disabled={loading}
          className="px-3 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? 'Creating…' : 'Create account'}
        </button>
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
      <ul className="space-y-2">
        {accounts.map(a => (
          <li key={a.id} className="flex items-center gap-2">
            <span className="inline-block size-3 rounded-full" style={{ background: a.color || '#9ca3af' }} />
            <span className="font-medium">{a.name}</span>
            <span className="text-xs text-muted-foreground">({a.type} • {a.currency || 'UZS'})</span>
            {a.is_default ? <span className="ml-2 text-xs text-emerald-600">default</span> : null}
          </li>
        ))}
        {accounts.length === 0 && <li className="text-muted-foreground">No accounts yet</li>}
      </ul>
    </div>
  );
}
