import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';

describe('fast authentication redirect', () => {
  it('preserves the requested protected route and query when no cookie exists', () => {
    const response = proxy(new NextRequest('https://lifeos.test/week?date=2026-10-16'));
    const target = new URL(response.headers.get('location')!);
    expect(target.pathname).toBe('/login');
    expect(target.searchParams.get('next')).toBe('/week?date=2026-10-16');
  });

  it.each(['better-auth.session_token', '__Secure-better-auth.session_token'])(
    'defers %s validation to the authenticated page and action',
    (cookie) => {
      const response = proxy(
        new NextRequest('https://lifeos.test/today', {
          headers: { cookie: `${cookie}=untrusted-token` },
        }),
      );
      expect(response.headers.get('location')).toBeNull();
      expect(response.headers.get('x-middleware-next')).toBe('1');
      expect(response.headers.get('x-middleware-request-x-lifeos-return-to')).toBe('/today');
    },
  );

  it.each(['/login', '/register', '/dashboard-public'])('allows %s through', (path) => {
    const response = proxy(new NextRequest(`https://lifeos.test${path}`));
    expect(response.headers.get('location')).toBeNull();
  });
});
