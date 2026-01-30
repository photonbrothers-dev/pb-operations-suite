import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createHash } from "crypto";

const AUTH_SALT = process.env.AUTH_SALT || "pb-ops-default-salt";

/** Generate a SHA-256 token from the password + salt */
function hashToken(password: string): string {
  return createHash("sha256")
    .update(password + AUTH_SALT)
    .digest("hex");
}

export function middleware(request: NextRequest) {
  // Skip API routes (they have their own auth)
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Skip static files
  if (
    request.nextUrl.pathname.startsWith("/_next/") ||
    request.nextUrl.pathname.startsWith("/static/") ||
    request.nextUrl.pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Check for password protection
  const password = process.env.SITE_PASSWORD;

  if (!password) {
    // No password set, allow access
    return NextResponse.next();
  }

  // Check for auth cookie - compare against hashed token
  const authCookie = request.cookies.get("pb-auth");
  const expectedToken = hashToken(password);

  if (authCookie?.value === expectedToken) {
    return NextResponse.next();
  }

  // Redirect to login page
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("redirect", request.nextUrl.pathname);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - login (login page)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|login).*)",
  ],
};
