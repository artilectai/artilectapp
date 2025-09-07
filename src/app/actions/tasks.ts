'use server';

import { supabaseServer } from '@/lib/supabase/server';

export async function createTask(input: {
  title: string;
  description?: string;
  status?: 'todo' | 'doing' | 'done' | 'skipped';
  priority?: 'high' | 'medium' | 'low';
  start_date?: string;
  due_date?: string;
  estimate_hours?: number;
  tags?: string[];
}) {
  const supabase = await supabaseServer();
  const {
    data: { user },
    error: uErr,
  } = await supabase.auth.getUser();
  if (uErr || !user) throw new Error('Not signed in');

  const { error } = await supabase.from('tasks').insert({
    user_id: user.id,
    ...input,
  });
  if (error) throw error;
}
