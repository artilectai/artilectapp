"use client";

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { logSession } from '@/app/actions/workout/sessions';

type Session = {
  id: string;
  program_id?: string | null;
  started_at: string;
  ended_at?: string | null;
  duration_min?: number | null;
  calories?: number | null;
  notes?: string | null;
  created_at?: string | null;
};

export default function WorkoutSessionsPage() {
  const [items, setItems] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const { data, error } = await supabase
      .from('workout_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      setError(error.message);
      setItems([]);
    } else {
      setItems((data as Session[]) || []);
    }
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel('workout-sessions-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workout_sessions' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const handleLog = async () => {
    try {
      setLoading(true);
      const started = new Date().toISOString();
      await logSession({ started_at: started, duration_min: 30, calories: 200, notes: 'Demo session' });
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to log session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={handleLog} disabled={loading} className="px-3 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
          {loading ? 'Logging…' : 'Log session'}
        </button>
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
      <ul className="space-y-2">
        {items.map(s => (
          <li key={s.id}>
            <span className="font-medium">{new Date(s.started_at).toLocaleString()}</span>
            {s.duration_min ? <span className="text-xs text-muted-foreground"> • {s.duration_min} min</span> : null}
            {s.calories ? <span className="text-xs text-muted-foreground"> • {s.calories} kcal</span> : null}
            {s.notes ? <span className="text-sm"> • {s.notes}</span> : null}
          </li>
        ))}
        {items.length === 0 && <li className="text-muted-foreground">No sessions yet</li>}
      </ul>
    </div>
  );
}
