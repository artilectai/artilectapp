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
	// Build a robust list of trusted origins (CORS) for BetterAuth
	const trusted = new Set<string>();
	const add = (v?: string | null) => {
		if (!v) return;
		try {
			// Accept bare hosts like "my-app.vercel.app" or full URLs
			const url = v.includes("http") ? new URL(v) : new URL(`https://${v}`);
			trusted.add(`${url.protocol}//${url.host}`);
		} catch {
			// Fallback: if it's already a host-only string
			trusted.add(v);
		}
	};
	// Local/dev defaults
	add("http://localhost:3000");
	// Canonical URL vars
	add(process.env.SITE_URL ?? null);
	add(process.env.NEXT_PUBLIC_SITE_URL ?? null);
	// Vercel provided hostnames (preview/prod)
	add(process.env.VERCEL_URL ?? null); // e.g. artilectapp-psi.vercel.app
	add(process.env.NEXT_PUBLIC_VERCEL_URL ?? null);
	// Optional comma-separated list
	if (process.env.AUTH_TRUSTED_ORIGINS) {
		process.env.AUTH_TRUSTED_ORIGINS.split(/[,\n\s]+/)
			.map(s => s.trim())
			.filter(Boolean)
			.forEach(add);
	}

	_auth = betterAuth({
		database: drizzleAdapter(db, { provider: "sqlite" }),
		emailAndPassword: { enabled: true },
		plugins: [bearer()],
		trustedOrigins: Array.from(trusted)
	});
	return _auth;
}

// Session validation helper
export async function getCurrentUser(request: NextRequest) {
	const session = await getAuth().api.getSession({ headers: await headers() });
	return session?.user || null;
}
