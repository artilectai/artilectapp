import { NextRequest, NextResponse } from 'next/server';
import { supabaseServiceRole } from '@/lib/supabase/admin';
import { supabaseServer } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const sb = await supabaseServer();
    let { data: { user } } = await sb.auth.getUser();
    // Fallback: accept Authorization: Bearer <token> for first-call races before cookies settle
    if (!user) {
      const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
      const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
      if (token && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        const alt = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
        const res = await alt.auth.getUser(token);
        user = res.data.user ?? null;
      }
    }
    // If still no user, quietly skip to avoid confusing 401s in reg flow
    if (!user) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'No auth session yet' });
    }

  const body = await request.json().catch(() => ({}));
  const phone: string | null = body?.phone ?? null;
  const nameFromBody: string | null = body?.name ?? null;

    // If service role is not configured, treat as a no-op so UX continues
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'Supabase admin not configured' });
    }

    const admin = supabaseServiceRole();
    const now = new Date().toISOString();
    const { error } = await admin.from('user_profiles').upsert({
      user_id: user.id,
      email: (user as any).email ?? null,
      name: nameFromBody ?? (user as any).user_metadata?.name ?? null,
      phone,
      created_at: now,
      updated_at: now,
    }, { onConflict: 'user_id' });

    if (error) {
      // If table is missing, surface a helpful message but do not break auth flow
      return NextResponse.json({ ok: false, error: error.message }, { status: 200 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 200 });
  }
}
