import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  // Optimistic navigation only. The demo cookie permits sample screens, never API access.
  if (!getSessionCookie(request) && request.cookies.get("bv_demo")?.value !== "1") {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}
export const config = { matcher: ["/case/:path*"] };
