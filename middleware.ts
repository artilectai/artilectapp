import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
 
export async function middleware(request: NextRequest) {
	// If someone hits the site root directly (e.g., from the bot "Open" button),
	// send them to the Telegram deep link that launches the Mini App full screen
	try {
		const url = new URL(request.url);
		// Optional bypass with ?web=1 to allow web debugging
		const bypass = url.searchParams.get('web');
		if (url.pathname === '/' && bypass !== '1') {
			return NextResponse.redirect('https://t.me/ArtiLectAIbot/?startapp&addToHomeScreen');
		}
	} catch {}
	// Prepare a response we can mutate cookies on
	const response = NextResponse.next();

	// Check Supabase Auth session
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
	"/((?!api|_next/static|_next/image|favicon.ico|login|register|onboarding|update-password|locales).*)"
  ],
};