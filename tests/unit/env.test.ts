import { describe, expect, it } from 'vitest';
import { parseServerEnv, previewOrigins } from '@/lib/env';

const validEnv = {
  DATABASE_URL: 'postgresql://habitflow:habitflow@localhost:5433/habitflow',
  BETTER_AUTH_SECRET: 'a-long-development-secret-with-32-chars',
  BETTER_AUTH_URL: 'http://localhost:3000',
};

describe('server environment validation', () => {
  it('accepts the documented local development variables', () => {
    expect(parseServerEnv(validEnv).DATABASE_URL).toBe(validEnv.DATABASE_URL);
  });

  it('reports variable names without leaking values', () => {
    expect(() => parseServerEnv({ ...validEnv, DATABASE_URL: 'invalid-secret-value' })).toThrow(
      'Invalid server environment variables: DATABASE_URL',
    );
  });

  it('uses the Vercel preview URL when no auth origin is configured', () => {
    const { BETTER_AUTH_URL: _unset, ...rest } = validEnv;
    void _unset;
    const preview = {
      ...rest,
      VERCEL_ENV: 'preview',
      VERCEL_URL: 'lifeos-abc123.vercel.app',
      VERCEL_BRANCH_URL: 'lifeos-git-fix-branch.vercel.app',
    };
    expect(parseServerEnv(preview).BETTER_AUTH_URL).toBe(
      'https://lifeos-git-fix-branch.vercel.app',
    );
    expect(previewOrigins(preview)).toEqual([
      'https://lifeos-git-fix-branch.vercel.app',
      'https://lifeos-abc123.vercel.app',
    ]);
    expect(
      parseServerEnv({ ...preview, BETTER_AUTH_URL: 'https://review.example.com' }).BETTER_AUTH_URL,
    ).toBe('https://review.example.com');
  });

  it('never infers the auth origin outside previews', () => {
    const { BETTER_AUTH_URL: _unset, ...rest } = validEnv;
    void _unset;
    for (const VERCEL_ENV of ['production', undefined])
      expect(() =>
        parseServerEnv({ ...rest, VERCEL_ENV, VERCEL_URL: 'lifeos-abc123.vercel.app' }),
      ).toThrow('Invalid server environment variables: BETTER_AUTH_URL');
    expect(previewOrigins({ VERCEL_ENV: 'production', VERCEL_URL: 'x.vercel.app' })).toEqual([]);
  });

  it('requires HTTPS and TLS on Vercel production', () => {
    expect(() => parseServerEnv({ ...validEnv, VERCEL_ENV: 'production' })).toThrow(
      'Invalid production environment variables',
    );
    expect(
      parseServerEnv({
        ...validEnv,
        VERCEL_ENV: 'production',
        DATABASE_URL: 'postgresql://user:pass@ep-example-pooler.neon.tech/db?sslmode=require',
        BETTER_AUTH_URL: 'https://habitflow.example.com',
        NEXT_PUBLIC_APP_URL: 'https://habitflow.example.com',
      }).BETTER_AUTH_URL,
    ).toBe('https://habitflow.example.com');
  });
});
