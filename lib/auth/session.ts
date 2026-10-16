import { cache } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';
import { safeNextPath } from '@/lib/auth/redirect';

/** The only source of user identity for server-rendered application code. */
export const getCurrentUser = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    const returnTo = (await headers()).get('x-lifeos-return-to');
    redirect(returnTo ? `/login?next=${encodeURIComponent(safeNextPath(returnTo))}` : '/login');
  }
  return user;
}
