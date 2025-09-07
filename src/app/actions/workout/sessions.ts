'use server';

import { supabaseServer } from '@/lib/supabase/server';

export async function logSession(input: {
  program_id?: string;
  started_at: string; // ISO
  ended_at?: string;
  duration_min?: number;
  calories?: number;
  notes?: string;
}) {
  const sb = await supabaseServer();
  const { data: { user }, error: uErr } = await sb.auth.getUser();
  if (uErr || !user) throw new Error('Not signed in');
  const { error } = await sb.from('workout_sessions').insert({ user_id: user.id, ...input });
  if (error) throw error;
}
