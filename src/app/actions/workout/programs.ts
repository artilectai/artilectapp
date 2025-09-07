'use server';

import { supabaseServer } from '@/lib/supabase/server';

export type SportType = 'cardio' | 'strength' | 'flexibility' | 'sports';

export async function createProgram(
  name: string,
  sport_type: SportType,
  frequency = 0
) {
  const sb = await supabaseServer();
  const { data: { user }, error: uErr } = await sb.auth.getUser();
  if (uErr || !user) throw new Error('Not signed in');
  const { error } = await sb
    .from('workout_programs')
    .insert({ user_id: user.id, name, sport_type, frequency });
  if (error) throw error;
}
