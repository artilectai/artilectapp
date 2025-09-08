'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function AuthBox() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const TELEGRAM_START_URL = (process.env.NEXT_PUBLIC_TELEGRAM_START_URL || 'https://t.me/ArtiLectAIbot');

  async function signIn() {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: TELEGRAM_START_URL } as any,
    });
    if (error) setError(error.message);
    else setSent(true);
    setLoading(false);
  }

  if (sent) return <p className="text-sm text-muted-foreground">Check your email to finish sign in.</p>;

  return (
    <div className="space-y-2">
      <input
        className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-money-green/50"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        type="email"
      />
      <button
        className="w-full rounded-md bg-money-green text-black text-sm font-semibold px-3 py-2 hover:opacity-90 transition"
        onClick={signIn}
        disabled={loading || !email}
      >
        {loading ? 'Sending…' : 'Sign in via Email'}
      </button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
