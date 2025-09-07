import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/transactions/list?account_id=&type=&limit=&offset=&search=&sort=occurred_at|created_at&order=asc|desc&id=
export async function GET(request: NextRequest) {
  try {
    const sb = await supabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (id) {
      const { data, error } = await sb
        .from('finance_transactions')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      if (!data) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
      return NextResponse.json(data, { status: 200 });
    }

    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const type = searchParams.get('type');
    const account_id = searchParams.get('account_id');
    const search = searchParams.get('search');
    const sort = searchParams.get('sort') || 'occurred_at';
    const asc = (searchParams.get('order') || 'desc').toLowerCase() === 'asc';

    let q = sb.from('finance_transactions').select('*').eq('user_id', user.id);
    if (type) q = q.eq('type', type);
    if (account_id) q = q.eq('account_id', account_id);
    if (search) q = q.ilike('description', `%${search}%`);

    const { data, error } = await q.order(sort as any, { ascending: asc }).range(offset, offset + limit - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data ?? [], { status: 200 });
  } catch (e: any) {
    console.error('transactions GET error:', e);
    const msg = e?.message ? String(e.message) : String(e);
    return NextResponse.json({ error: 'Internal error: ' + msg }, { status: 500 });
  }
}

// POST /api/transactions/list { account_id, category_id?, type, amount, currency?, description?, tags?, occurred_at? }
export async function POST(request: NextRequest) {
  try {
    const sb = await supabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    if (!body?.account_id || !body?.type || body?.amount == null) {
      return NextResponse.json({ error: 'account_id, type and amount are required' }, { status: 400 });
    }

    const insert = {
      user_id: user.id,
      currency: body.currency ?? 'UZS',
      ...body,
    };
    const { data, error } = await sb.from('finance_transactions').insert(insert).select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    console.error('transactions POST error:', e);
    const msg = e?.message ? String(e.message) : String(e);
    return NextResponse.json({ error: 'Internal error: ' + msg }, { status: 500 });
  }
}

// PUT /api/transactions/list?id=... { ...patch }
export async function PUT(request: NextRequest) {
  try {
    const sb = await supabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const { data: exists, error: e1 } = await sb
      .from('finance_transactions')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (e1) return NextResponse.json({ error: e1.message }, { status: 400 });
    if (!exists) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });

    const body = await request.json();
    const { data, error } = await sb
      .from('finance_transactions')
      .update(body)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data, { status: 200 });
  } catch (e: any) {
    console.error('transactions PUT error:', e);
    const msg = e?.message ? String(e.message) : String(e);
    return NextResponse.json({ error: 'Internal error: ' + msg }, { status: 500 });
  }
}

// DELETE /api/transactions/list?id=...
export async function DELETE(request: NextRequest) {
  try {
    const sb = await supabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const { data: exists, error: e1 } = await sb
      .from('finance_transactions')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (e1) return NextResponse.json({ error: e1.message }, { status: 400 });
    if (!exists) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });

    const { error } = await sb
      .from('finance_transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ message: 'Deleted' }, { status: 200 });
  } catch (e: any) {
    console.error('transactions DELETE error:', e);
    const msg = e?.message ? String(e.message) : String(e);
    return NextResponse.json({ error: 'Internal error: ' + msg }, { status: 500 });
  }
}