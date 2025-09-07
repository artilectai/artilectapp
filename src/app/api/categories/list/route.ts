import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/categories/list?type=income|expense&search=&limit=&offset=&sort=name|created_at&order=asc|desc&id=
export async function GET(request: NextRequest) {
	try {
		const sb = await supabaseServer();
		const { data: { user } } = await sb.auth.getUser();
		if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

		const { searchParams } = new URL(request.url);
		const id = searchParams.get('id');
		if (id) {
			const { data, error } = await sb
				.from('finance_categories')
				.select('*')
				.eq('id', id)
				.eq('user_id', user.id)
				.maybeSingle();
			if (error) return NextResponse.json({ error: error.message }, { status: 400 });
			if (!data) return NextResponse.json({ error: 'Category not found' }, { status: 404 });
			return NextResponse.json(data, { status: 200 });
		}

		const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
		const offset = parseInt(searchParams.get('offset') || '0');
		const type = searchParams.get('type');
		const search = searchParams.get('search');
		const sort = searchParams.get('sort') || 'created_at';
		const asc = (searchParams.get('order') || 'desc').toLowerCase() === 'asc';

		let q = sb.from('finance_categories').select('*').eq('user_id', user.id);
		if (type) q = q.eq('type', type);
		if (search) q = q.ilike('name', `%${search}%`);

		const { data, error } = await q.order(sort as any, { ascending: asc }).range(offset, offset + limit - 1);
		if (error) return NextResponse.json({ error: error.message }, { status: 400 });
		return NextResponse.json(data ?? [], { status: 200 });
		} catch (e: any) {
			console.error('categories GET error:', e);
			const msg = e?.message ? String(e.message) : String(e);
			return NextResponse.json({ error: 'Internal error: ' + msg }, { status: 500 });
		}
}

// POST /api/categories/list { name, type, color }
export async function POST(request: NextRequest) {
	try {
		const sb = await supabaseServer();
		const { data: { user } } = await sb.auth.getUser();
		if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

		const body = await request.json();
		if (!body?.name || !body?.type) {
			return NextResponse.json({ error: 'name and type are required' }, { status: 400 });
		}

		const insert = {
			user_id: user.id,
			name: String(body.name).trim(),
			type: String(body.type),
			color: body.color ?? null,
		};
		const { data, error } = await sb.from('finance_categories').insert(insert).select('*').single();
		if (error) return NextResponse.json({ error: error.message }, { status: 400 });
		return NextResponse.json(data, { status: 201 });
		} catch (e: any) {
			console.error('categories POST error:', e);
			const msg = e?.message ? String(e.message) : String(e);
			return NextResponse.json({ error: 'Internal error: ' + msg }, { status: 500 });
		}
}

// PUT /api/categories/list?id=... { name?, type?, color? }
export async function PUT(request: NextRequest) {
	try {
		const sb = await supabaseServer();
		const { data: { user } } = await sb.auth.getUser();
		if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

		const { searchParams } = new URL(request.url);
		const id = searchParams.get('id');
		if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

		const { data: exists, error: e1 } = await sb
			.from('finance_categories')
			.select('id')
			.eq('id', id)
			.eq('user_id', user.id)
			.maybeSingle();
		if (e1) return NextResponse.json({ error: e1.message }, { status: 400 });
		if (!exists) return NextResponse.json({ error: 'Category not found' }, { status: 404 });

		const body = await request.json();
		const patch: any = {};
		if (body.name !== undefined) patch.name = String(body.name).trim();
		if (body.type !== undefined) patch.type = String(body.type);
		if (body.color !== undefined) patch.color = body.color ?? null;

		const { data, error } = await sb
			.from('finance_categories')
			.update(patch)
			.eq('id', id)
			.eq('user_id', user.id)
			.select('*')
			.single();
		if (error) return NextResponse.json({ error: error.message }, { status: 400 });
		return NextResponse.json(data, { status: 200 });
		} catch (e: any) {
			console.error('categories PUT error:', e);
			const msg = e?.message ? String(e.message) : String(e);
			return NextResponse.json({ error: 'Internal error: ' + msg }, { status: 500 });
		}
}

// DELETE /api/categories/list?id=...
export async function DELETE(request: NextRequest) {
	try {
		const sb = await supabaseServer();
		const { data: { user } } = await sb.auth.getUser();
		if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

		const { searchParams } = new URL(request.url);
		const id = searchParams.get('id');
		if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

		const { data: exists, error: e1 } = await sb
			.from('finance_categories')
			.select('id')
			.eq('id', id)
			.eq('user_id', user.id)
			.maybeSingle();
		if (e1) return NextResponse.json({ error: e1.message }, { status: 400 });
		if (!exists) return NextResponse.json({ error: 'Category not found' }, { status: 404 });

		const { error } = await sb
			.from('finance_categories')
			.delete()
			.eq('id', id)
			.eq('user_id', user.id);
		if (error) return NextResponse.json({ error: error.message }, { status: 400 });
		return NextResponse.json({ message: 'Deleted' }, { status: 200 });
		} catch (e: any) {
			console.error('categories DELETE error:', e);
			const msg = e?.message ? String(e.message) : String(e);
			return NextResponse.json({ error: 'Internal error: ' + msg }, { status: 500 });
		}
}