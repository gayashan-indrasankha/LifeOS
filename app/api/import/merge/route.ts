import { and, eq, inArray } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/session';
import { backupTables } from '@/lib/backup/format';
import { BackupRequestError, readBackupRequest } from '@/lib/backup/request';
import { db } from '@/lib/db';
import { habits, taskCompletions, userSettings } from '@/lib/db/schema';

function sameValue(a: unknown, b: unknown) {
  const normalize = (value: unknown) => (value instanceof Date ? value.toISOString() : value);
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const source = request.headers.get('origin');
  const expected = new URL(process.env.BETTER_AUTH_URL ?? request.url).origin;
  if (source !== expected) {
    return Response.json({ error: 'Import must come from this app.' }, { status: 403 });
  }
  let backup;
  try {
    backup = await readBackupRequest(request);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof BackupRequestError
            ? error.message
            : 'This is not a valid LifeOS JSON backup.',
      },
      { status: error instanceof BackupRequestError ? error.status : 400 },
    );
  }

  try {
    const result = await db.transaction(async (tx) => {
      let added = 0;
      let alreadyPresent = 0;
      for (const [name, table] of backupTables) {
        const rows = backup.rows[name];
        if (name === 'userSettings') {
          for (const row of rows) {
            const existing = await tx.query.userSettings.findFirst({
              where: eq(userSettings.userId, user.id),
            });
            if (existing) {
              if (
                !Object.entries(row).every(([key, value]) =>
                  sameValue(existing[key as keyof typeof existing], value),
                )
              ) {
                throw new Error('Conflicting settings');
              }
              alreadyPresent++;
            } else {
              await tx
                .insert(userSettings)
                .values({ ...row, userId: user.id } as typeof userSettings.$inferInsert);
              added++;
            }
          }
          continue;
        }
        if (name === 'taskCompletions') {
          for (const row of rows) {
            const [existing] = await tx
              .select()
              .from(taskCompletions)
              .where(
                and(
                  eq(taskCompletions.userId, user.id),
                  eq(taskCompletions.taskId, row.taskId as string),
                  eq(taskCompletions.date, row.date as string),
                ),
              )
              .limit(1);
            if (existing) {
              if (!sameValue(existing.completedAt, row.completedAt))
                throw new Error('Conflicting task completion record');
              alreadyPresent++;
            } else {
              await tx
                .insert(taskCompletions)
                .values({ ...row, userId: user.id } as typeof taskCompletions.$inferInsert);
              added++;
            }
          }
          continue;
        }

        const typedTable = table as typeof habits;
        for (let start = 0; start < rows.length; start += 100) {
          const group = rows.slice(start, start + 100);
          const ids = group.map((row) => row.id as string);
          const found = await tx.select().from(typedTable).where(inArray(typedTable.id, ids));
          const existingById = new Map(found.map((row) => [row.id, row]));
          const additions = [];
          for (const row of group) {
            const existing = existingById.get(row.id as string);
            if (existing) {
              if (
                existing.userId !== user.id ||
                !Object.entries(row).every(([key, value]) =>
                  sameValue(existing[key as keyof typeof existing], value),
                )
              ) {
                throw new Error(`Conflicting ${name} record`);
              }
              alreadyPresent++;
            } else {
              additions.push({ ...row, userId: user.id });
            }
          }
          if (additions.length) {
            await tx.insert(typedTable).values(additions as (typeof habits.$inferInsert)[]);
            added += additions.length;
          }
        }
      }
      return { added, alreadyPresent };
    });
    return Response.json(result);
  } catch (error) {
    console.error('LifeOS safe backup merge failed', error);
    return Response.json(
      {
        error:
          'This backup conflicts with data already in the account. Nothing was changed. Export your current data before resolving the differences.',
      },
      { status: 409 },
    );
  }
}
