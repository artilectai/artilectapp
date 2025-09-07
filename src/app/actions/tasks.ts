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

export async function updateTask(input: {
  id: string;
  title?: string;
  description?: string;
  status?: 'todo' | 'doing' | 'done' | 'skipped';
  priority?: 'high' | 'medium' | 'low';
  start_date?: string | null;
  due_date?: string | null;
  estimate_hours?: number | null;
  tags?: string[] | null;
  completed_at?: string | null;
}) {
  const supabase = await supabaseServer();
  const {
    data: { user },
    error: uErr,
  } = await supabase.auth.getUser();
  if (uErr || !user) throw new Error('Not signed in');

  const updateBody: any = { updated_at: new Date().toISOString() };
  if (typeof input.title !== 'undefined') updateBody.title = input.title;
  if (typeof input.description !== 'undefined') updateBody.description = input.description;
  if (typeof input.status !== 'undefined') updateBody.status = input.status;
  if (typeof input.priority !== 'undefined') updateBody.priority = input.priority;
  if (typeof input.start_date !== 'undefined') updateBody.start_date = input.start_date;
  if (typeof input.due_date !== 'undefined') updateBody.due_date = input.due_date;
  if (typeof input.estimate_hours !== 'undefined') updateBody.estimate_hours = input.estimate_hours;
  if (typeof input.tags !== 'undefined') updateBody.tags = input.tags;
  if (typeof input.completed_at !== 'undefined') updateBody.completed_at = input.completed_at;

  const { error } = await supabase
    .from('tasks')
    .update(updateBody)
    .eq('id', input.id)
    .eq('user_id', user.id);
  if (error) throw error;
}
