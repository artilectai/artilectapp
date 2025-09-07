"use client";

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { createProgram } from '@/app/actions/workout/programs';

type Program = {
  id: string;
  name: string;
  sport_type: 'cardio' | 'strength' | 'flexibility' | 'sports';
  frequency: number;
  created_at?: string;
};

export default function WorkoutProgramsPage() {
  const [items, setItems] = useState<Program[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const { data, error } = await supabase
      .from('workout_programs')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      setError(error.message);
      setItems([]);
    } else {
      setItems((data as Program[]) || []);
    }
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel('workout-programs-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workout_programs' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const handleCreate = async () => {
    try {
      setLoading(true);
      await createProgram('Cardio Starter', 'cardio', 3);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to create program');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={handleCreate} disabled={loading} className="px-3 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
          {loading ? 'Creating…' : 'Create program'}
        </button>
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
      <ul className="space-y-2">
        {items.map(p => (
          <li key={p.id}>
            <span className="font-medium">{p.name}</span>
            <span className="text-xs text-muted-foreground"> • {p.sport_type} • {p.frequency}/wk</span>
          </li>
        ))}
        {items.length === 0 && <li className="text-muted-foreground">No programs yet</li>}
      </ul>
    </div>
  );
}
