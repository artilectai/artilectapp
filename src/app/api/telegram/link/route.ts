import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseServiceRole } from '@/lib/supabase/admin';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const sb = await supabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Not signed in' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const code = (body?.code || '').trim();
    if (!code) {
      return NextResponse.json({ ok: false, error: 'Code is required' }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const hasService = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    const admin = hasService ? supabaseServiceRole() : createClient(url, anon);

    // Look up the code
    const lookup = await admin.from('telegram_link_codes').select('*').eq('code', code).limit(1).maybeSingle();
    if ((lookup as any).error || !lookup.data) {
      return NextResponse.json({ ok: false, error: 'Invalid code' }, { status: 400 });
    }
    const row = lookup.data as any;

    // Upsert the link
    const up = await admin.from('telegram_links').upsert({
      user_id: user.id,
      telegram_user_id: row.telegram_user_id,
    });
    if ((up as any).error) {
      return NextResponse.json({ ok: false, error: (up as any).error.message || 'Failed to link' }, { status: 400 });
    }

    // Mark code consumed (best-effort)
    await admin.from('telegram_link_codes').update({ consumed_by: user.id }).eq('code', code);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
