"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from './client';

type SessionState = {
  data: { user: any | null } | null;
  isPending: boolean;
  error: any;
  refetch: () => void;
};

export function useSession(): SessionState {
  const [user, setUser] = useState<any | null>(null);
  const [isPending, setIsPending] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

  const fetchSession = useCallback(async () => {
    setIsPending(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      setUser(data.user ?? null);
    } catch (e) {
      setError(e);
      setUser(null);
    } finally {
      setIsPending(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      fetchSession();
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [fetchSession]);

  return { data: { user }, isPending, error, refetch: fetchSession };
}

export async function signOut() {
  await supabase.auth.signOut();
}
