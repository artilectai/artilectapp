import { getAuth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import type { NextRequest } from "next/server";

// Lazily create the handler inside each request to avoid touching DB/env at module load time
function getHandler() {
	return toNextJsHandler(getAuth());
}

// Ensure this route is always treated as dynamic to avoid build-time execution
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
	const { GET } = getHandler();
	return GET(request);
}

export async function POST(request: NextRequest) {
	const { POST } = getHandler();
	return POST(request);
}