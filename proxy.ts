import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

// Routes that require authentication
const PROTECTED_PREFIXES = [
  '/today',
  '/week',
  '/goals',
  '/review',
  '/dashboard',
  '/habits',
  '/notes',
  '/settings',
];

function matchesRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((prefix) => matchesRoute(pathname, prefix));
  if (!isProtected) {
    return NextResponse.next();
  }

  // This is only a fast redirect for missing cookies. Pages, actions and API
  // handlers still validate the session against the database before reading data.
  // Doing that here as well adds a serial DB round trip to every prefetch/save.
  if (!getSessionCookie(request)) {
    const signInUrl = new URL('/login', request.url);
    signInUrl.searchParams.set('next', pathname + request.nextUrl.search);
    return NextResponse.redirect(signInUrl);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-lifeos-return-to', pathname + request.nextUrl.search);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
