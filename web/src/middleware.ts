import { NextResponse, type NextRequest } from 'next/server';

/**
 * Edge-level guard: redirects to /login before the (app) shell ever renders
 * if there's no auth cookie at all. This is a presence check only — the
 * cookie is httpOnly so its signature/expiry can't be cheaply verified here;
 * GET /api/auth/me (called by AuthProvider) remains the source of truth for
 * whether the session is actually valid and which role it has.
 */
const AUTH_COOKIE_NAME = 'salon_token';

const PROTECTED_PREFIXES = ['/admin', '/reception', '/super'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!isProtected) {
    return NextResponse.next();
  }

  const hasCookie = request.cookies.has(AUTH_COOKIE_NAME);
  if (!hasCookie) {
    // Always bounces to the one public /login page — never to the hidden
    // super-admin URL, which must never appear in a redirect chain or it
    // stops being hidden.
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/reception/:path*', '/super/:path*'],
};
