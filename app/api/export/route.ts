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
  const bytes = new TextEncoder().encode(JSON.stringify(data, null, 2));
  let offset = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }
      controller.enqueue(bytes.subarray(offset, offset + 64 * 1024));
      offset += 64 * 1024;
    },
  });
  return new Response(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="lifeos-backup-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
