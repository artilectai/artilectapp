'use server';

import { supabaseServer } from '@/lib/supabase/server';

type Lang = 'en' | 'ru' | 'uz';

const DEFAULTS: Record<Lang, Array<{ name: string; type: 'income' | 'expense'; color: string }>> = {
  en: [
    { name: 'Salary', type: 'income', color: '#16a34a' },
    { name: 'Bonus', type: 'income', color: '#22c55e' },
    { name: 'Groceries', type: 'expense', color: '#ef4444' },
    { name: 'Transport', type: 'expense', color: '#f97316' },
    { name: 'Dining', type: 'expense', color: '#eab308' },
  ],
  ru: [
    { name: 'Зарплата', type: 'income', color: '#16a34a' },
    { name: 'Бонус', type: 'income', color: '#22c55e' },
    { name: 'Продукты', type: 'expense', color: '#ef4444' },
    { name: 'Транспорт', type: 'expense', color: '#f97316' },
    { name: 'Кафе', type: 'expense', color: '#eab308' },
  ],
  uz: [
    { name: 'Oylik', type: 'income', color: '#16a34a' },
    { name: 'Bonus', type: 'income', color: '#22c55e' },
    { name: 'Oziq-ovqat', type: 'expense', color: '#ef4444' },
    { name: 'Transport', type: 'expense', color: '#f97316' },
    { name: 'Ovqatlanish', type: 'expense', color: '#eab308' },
  ],
};

export async function seedDefaultFinanceCategories(lang: Lang = 'en') {
  const supabase = await supabaseServer();
  const { data: { user }, error: uErr } = await supabase.auth.getUser();
  if (uErr || !user) throw new Error('Not signed in');

  // Check if user already has categories
  const { data: existing, error: qErr } = await supabase
    .from('finance_categories')
    .select('id')
    .limit(1);
  if (qErr) throw qErr;
  if (existing && existing.length > 0) return; // already seeded

  const rows = DEFAULTS[lang].map((c) => ({ ...c, user_id: user.id }));
  const { error } = await supabase.from('finance_categories').insert(rows);
  if (error) throw error;
}
