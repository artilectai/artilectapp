import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() { return NextResponse.json({ error: 'Deprecated: use Supabase actions/endpoints' }, { status: 410 }); }
export async function PUT() { return NextResponse.json({ error: 'Deprecated: use Supabase actions/endpoints' }, { status: 410 }); }
export async function DELETE() { return NextResponse.json({ error: 'Deprecated: use Supabase actions/endpoints' }, { status: 410 }); }