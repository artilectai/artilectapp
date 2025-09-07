import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Unified endpoint for workouts with kind=programs|sessions
export async function GET(request: NextRequest) {
	try {
		const sb = await supabaseServer();
		const { data: { user } } = await sb.auth.getUser();
		if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

		const { searchParams } = new URL(request.url);
		const kind = searchParams.get('kind') || 'programs';
		const id = searchParams.get('id');
		const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
		const offset = parseInt(searchParams.get('offset') || '0');
		const sort = searchParams.get('sort') || 'created_at';
		const asc = (searchParams.get('order') || 'desc').toLowerCase() === 'asc';

		const table = kind === 'sessions' ? 'workout_sessions' : 'workout_programs';

		if (id) {
			const { data, error } = await sb
				.from(table)
				.select('*')
				.eq('id', id)
				.eq('user_id', user.id)
				.maybeSingle();
			if (error) return NextResponse.json({ error: error.message }, { status: 400 });
			if (!data) return NextResponse.json({ error: `${kind.slice(0, -1)} not found` }, { status: 404 });
			return NextResponse.json(data, { status: 200 });
		}

		let q = sb.from(table).select('*').eq('user_id', user.id);
		const { data, error } = await q.order(sort as any, { ascending: asc }).range(offset, offset + limit - 1);
		if (error) return NextResponse.json({ error: error.message }, { status: 400 });
		return NextResponse.json(data ?? [], { status: 200 });
	} catch (e: any) {
		console.error('workouts GET error:', e);
		const msg = e?.message ? String(e.message) : String(e);
		return NextResponse.json({ error: 'Internal error: ' + msg }, { status: 500 });
	}
}

export async function POST(request: NextRequest) {
	try {
		const sb = await supabaseServer();
		const { data: { user } } = await sb.auth.getUser();
		if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

		const { searchParams } = new URL(request.url);
		const kind = searchParams.get('kind') || 'programs';
		const table = kind === 'sessions' ? 'workout_sessions' : 'workout_programs';
		const body = await request.json();

		const insert = { user_id: user.id, ...body };
		const { data, error } = await sb.from(table).insert(insert).select('*').single();
		if (error) return NextResponse.json({ error: error.message }, { status: 400 });
		return NextResponse.json(data, { status: 201 });
	} catch (e: any) {
		console.error('workouts POST error:', e);
		const msg = e?.message ? String(e.message) : String(e);
		return NextResponse.json({ error: 'Internal error: ' + msg }, { status: 500 });
	}
}

export async function PUT(request: NextRequest) {
	try {
		const sb = await supabaseServer();
		const { data: { user } } = await sb.auth.getUser();
		if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

		const { searchParams } = new URL(request.url);
		const kind = searchParams.get('kind') || 'programs';
		const id = searchParams.get('id');
		if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
		const table = kind === 'sessions' ? 'workout_sessions' : 'workout_programs';

		const { data: exists, error: e1 } = await sb
			.from(table)
			.select('id')
			.eq('id', id)
			.eq('user_id', user.id)
			.maybeSingle();
		if (e1) return NextResponse.json({ error: e1.message }, { status: 400 });
		if (!exists) return NextResponse.json({ error: `${kind.slice(0, -1)} not found` }, { status: 404 });

		const body = await request.json();
		const { data, error } = await sb
			.from(table)
			.update(body)
			.eq('id', id)
			.eq('user_id', user.id)
			.select('*')
			.single();
		if (error) return NextResponse.json({ error: error.message }, { status: 400 });
		return NextResponse.json(data, { status: 200 });
	} catch (e: any) {
		console.error('workouts PUT error:', e);
		const msg = e?.message ? String(e.message) : String(e);
		return NextResponse.json({ error: 'Internal error: ' + msg }, { status: 500 });
	}
}

export async function DELETE(request: NextRequest) {
	try {
		const sb = await supabaseServer();
		const { data: { user } } = await sb.auth.getUser();
		if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

		const { searchParams } = new URL(request.url);
		const kind = searchParams.get('kind') || 'programs';
		const id = searchParams.get('id');
		if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
		const table = kind === 'sessions' ? 'workout_sessions' : 'workout_programs';

		const { data: exists, error: e1 } = await sb
			.from(table)
			.select('id')
			.eq('id', id)
			.eq('user_id', user.id)
			.maybeSingle();
		if (e1) return NextResponse.json({ error: e1.message }, { status: 400 });
		if (!exists) return NextResponse.json({ error: `${kind.slice(0, -1)} not found` }, { status: 404 });

		const { error } = await sb
			.from(table)
			.delete()
			.eq('id', id)
			.eq('user_id', user.id);
		if (error) return NextResponse.json({ error: error.message }, { status: 400 });
		return NextResponse.json({ message: 'Deleted' }, { status: 200 });
	} catch (e: any) {
		console.error('workouts DELETE error:', e);
		const msg = e?.message ? String(e.message) : String(e);
		return NextResponse.json({ error: 'Internal error: ' + msg }, { status: 500 });
	}
}