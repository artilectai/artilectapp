import { getAuth } from "@/lib/auth";
import { ensureAuthReady } from "@/db";
import { toNextJsHandler } from "better-auth/next-js";
import type { NextRequest } from "next/server";

// Lazily create the handler inside each request to avoid touching DB/env at module load time
function getHandler() {
	return toNextJsHandler(getAuth());
}

// Ensure this route is always treated as dynamic to avoid build-time execution
export const dynamic = "force-dynamic";
export const revalidate = 0;
// Force Node.js runtime so the database client (libsql/drizzle) works reliably.
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
	await ensureAuthReady().catch(() => {});
	const { GET } = getHandler();
	return GET(request);
}

export async function POST(request: NextRequest) {
	await ensureAuthReady().catch(() => {});
	const { POST } = getHandler();
	return POST(request);
}