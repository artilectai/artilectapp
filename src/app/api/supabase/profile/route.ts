import { NextRequest, NextResponse } from 'next/server';
import { supabaseServiceRole } from '@/lib/supabase/admin';
import { supabaseServer } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const phone: string | null = body?.phone ?? null;

    // If service role is not configured, treat as a no-op so UX continues
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'Supabase admin not configured' });
    }

    const admin = supabaseServiceRole();
    const now = new Date().toISOString();
    const { error } = await admin.from('user_profiles').upsert({
      user_id: user.id,
      email: (user as any).email ?? null,
      name: (user as any).user_metadata?.name ?? null,
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
