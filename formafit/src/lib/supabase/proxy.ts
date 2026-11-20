import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import type { Database } from "./database.types";

const PUBLIC_PATHS = ["/", "/logga-in", "/registrera", "/glomt-losenord", "/integritet"];
// The reminder job authenticates with CRON_SECRET in the route itself.
const PUBLIC_PREFIXES = ["/auth/", "/api/cron/"];
const AUTH_PAGES = ["/logga-in", "/registrera", "/glomt-losenord"];

export function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.includes(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

/** Refreshes the Supabase session cookie and protects private routes. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = publicEnv();

  const supabase = createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Do not run code between createServerClient and getClaims(): it refreshes the session.
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  if (!isSignedIn && !isPublicPath(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Inte inloggad" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/logga-in";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (isSignedIn && (AUTH_PAGES.includes(pathname) || pathname === "/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/hem";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
