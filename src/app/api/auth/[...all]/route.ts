import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() { return NextResponse.json({ error: 'Deprecated: BetterAuth removed; use Supabase auth' }, { status: 410 }); }
export async function POST() { return NextResponse.json({ error: 'Deprecated: BetterAuth removed; use Supabase auth' }, { status: 410 }); }