import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins";
import { NextRequest } from 'next/server';
import { headers } from "next/headers";
import { getDb } from "@/db";

let _auth: ReturnType<typeof betterAuth> | null = null;

export function getAuth() {
	if (_auth) return _auth;
	const db = getDb();
	_auth = betterAuth({
		database: drizzleAdapter(db, { provider: "sqlite" }),
		emailAndPassword: { enabled: true },
		plugins: [bearer()]
	});
	return _auth;
}

// Session validation helper
export async function getCurrentUser(request: NextRequest) {
	const session = await getAuth().api.getSession({ headers: await headers() });
	return session?.user || null;
}
