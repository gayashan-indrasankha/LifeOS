import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/session';
import { BackupFormatError, backupTables, parseBackup } from '@/lib/backup/format';
import { db } from '@/lib/db';
import { habits } from '@/lib/db/schema';

const MAX_BACKUP_BYTES = 25 * 1024 * 1024;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const origin = request.headers.get('origin');
  if (origin) {
    // Next can normalize a loopback request URL to localhost even when the
    // Android WebView sent the request to 127.0.0.1. Check the received host.
    const hosts = [
      request.headers.get('host'),
      request.headers.get('x-forwarded-host')?.split(',')[0]?.trim(),
    ].filter(Boolean);
    const allowedHosts = hosts.length ? hosts : [new URL(request.url).host];
    let sameOrigin = false;
    try {
      const source = new URL(origin);
      const protocol = request.headers.get('x-forwarded-proto') ?? new URL(request.url).protocol.slice(0, -1);
      sameOrigin = source.protocol === `${protocol}:` && allowedHosts.includes(source.host);
    } catch {
      // A null or malformed Origin must not authorize a data replacement.
    }
    if (!sameOrigin) {
      return Response.json({ error: 'Import must come from this app.' }, { status: 403 });
    }
  }
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return Response.json({ error: 'Choose a LifeOS JSON backup file.' }, { status: 415 });
  }
  const declaredSize = Number(request.headers.get('content-length'));
  if (declaredSize > MAX_BACKUP_BYTES) {
    return Response.json({ error: 'The backup exceeds the 25 MB limit.' }, { status: 413 });
  }

  let backup;
  try {
    const body = await request.text();
    if (Buffer.byteLength(body, 'utf8') > MAX_BACKUP_BYTES) {
      return Response.json({ error: 'The backup exceeds the 25 MB limit.' }, { status: 413 });
    }
    backup = parseBackup(JSON.parse(body));
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof BackupFormatError
            ? error.message
            : 'This is not a valid LifeOS JSON backup.',
      },
      { status: 400 },
    );
  }

  try {
    await db.transaction(async (tx) => {
      // A failed insert rolls back the entire replacement, including all deletions.
      for (const [, table] of [...backupTables].reverse()) {
        await tx.delete(table as typeof habits).where(eq((table as typeof habits).userId, user.id));
      }
      for (const [name, table] of backupTables) {
        const rows = backup.rows[name];
        if (!rows.length) continue;
        for (let start = 0; start < rows.length; start += 250) {
          await tx
            .insert(table as typeof habits)
            .values(
              rows
                .slice(start, start + 250)
                .map((row) => ({ ...row, userId: user.id })) as (typeof habits.$inferInsert)[],
            );
        }
      }
    });
  } catch (error) {
    console.error('LifeOS backup import failed', error);
    return Response.json(
      {
        error:
          'The backup could not be restored. Your existing data was kept. Check that this backup belongs to a compatible LifeOS version.',
      },
      { status: 400 },
    );
  }

  return Response.json({ importedRecords: backup.totalRecords, exportedAt: backup.exportedAt });
}
