import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/session';
import { backupTables } from '@/lib/backup/format';
import { db } from '@/lib/db';
import { habits } from '@/lib/db/schema';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const sections = await Promise.all(
    backupTables.map(async ([name, table]) => {
      const rows = await db
        .select()
        .from(table as typeof habits)
        .where(eq((table as typeof habits).userId, user.id));
      return [
        name,
        rows.map(({ userId: _userId, ...record }) => {
          void _userId;
          return record;
        }),
      ] as const;
    }),
  );

  const data = {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    ...Object.fromEntries(sections),
  };
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="lifeos-backup-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
