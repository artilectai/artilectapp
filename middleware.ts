import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { createServerClient } from "@supabase/ssr";
 
export async function middleware(request: NextRequest) {
	// Prepare a response we can mutate cookies on
	const response = NextResponse.next();

	// 1) Allow if BetterAuth session exists
	const session = await auth.api.getSession({ headers: await headers() });
	if (session) return response;

	// 2) Otherwise, check Supabase Auth session
	const supabase = createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
		{
			cookies: {
				get(name: string) {
					return request.cookies.get(name)?.value;
				},
				set(name: string, value: string, options: any) {
					response.cookies.set({ name, value, ...options });
				},
				remove(name: string, options: any) {
					response.cookies.set({ name, value: "", ...options });
				},
			},
		}
	);
	const { data: { user } } = await supabase.auth.getUser();
	if (user) return response;

	// No session in either system — redirect to login
	return NextResponse.redirect(new URL("/login", request.url));
}
 
export const config = {
  runtime: "nodejs",
  matcher: [
    "/", 
	// Exclude static assets required for i18n (public/locales/**) and other public files
	"/((?!api|_next/static|_next/image|favicon.ico|login|register|onboarding|locales).*)"
  ],
};