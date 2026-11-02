import { z } from 'zod';

const serverEnvSchema = z.object({
  DATABASE_URL: z
    .url()
    .refine((value) => value.startsWith('postgres://') || value.startsWith('postgresql://'), {
      message: 'DATABASE_URL must be a PostgreSQL connection URL',
    }),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  NEXT_PUBLIC_APP_URL: z.url().optional(),
});

/** Origins Vercel assigns to a preview deployment: its own URL and its branch URL. */
export function previewOrigins(values: Record<string, string | undefined>): string[] {
  if (values.VERCEL_ENV !== 'preview') return [];
  return [values.VERCEL_BRANCH_URL, values.VERCEL_URL]
    .filter((host): host is string => Boolean(host))
    .map((host) => `https://${host}`);
}

export function parseServerEnv(values: Record<string, string | undefined>) {
  // Every preview gets a new URL, so it cannot be configured ahead of time.
  // Production still requires an explicit canonical origin, checked below.
  const [previewOrigin] = previewOrigins(values);
  const result = serverEnvSchema.safeParse(
    previewOrigin && !values.BETTER_AUTH_URL
      ? { ...values, BETTER_AUTH_URL: previewOrigin }
      : values,
  );
  if (!result.success) {
    const names = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid server environment variables: ${names}`);
  }
  if (values.VERCEL_ENV === 'production') {
    const database = new URL(result.data.DATABASE_URL);
    const auth = new URL(result.data.BETTER_AUTH_URL);
    const app = result.data.NEXT_PUBLIC_APP_URL ? new URL(result.data.NEXT_PUBLIC_APP_URL) : null;
    const invalid = [
      database.hostname === 'localhost' ||
      database.hostname === '127.0.0.1' ||
      database.searchParams.get('sslmode') !== 'require'
        ? 'DATABASE_URL'
        : null,
      auth.protocol !== 'https:' ||
      /^(localhost|127\.0\.0\.1)$/.test(auth.hostname) ||
      auth.pathname !== '/'
        ? 'BETTER_AUTH_URL'
        : null,
      !app || app.protocol !== 'https:' || app.origin !== auth.origin || app.pathname !== '/'
        ? 'NEXT_PUBLIC_APP_URL'
        : null,
    ].filter(Boolean);
    if (invalid.length)
      throw new Error(`Invalid production environment variables: ${invalid.join(', ')}`);
  }
  return result.data;
}
