import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { habitEntries, habits } from '@/lib/db/schema';
import { getHabitScheduleRevisions } from '@/lib/dal/habits';

/**
 * Get all habit entries for a user within a date range (for month view).
 * Single indexed query — no N+1.
 */
export async function getEntriesByUserAndMonth(userId: string, year: number, month: number) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  return db
    .select()
    .from(habitEntries)
    .where(
      and(
        eq(habitEntries.userId, userId),
        gte(habitEntries.date, startDate),
        lte(habitEntries.date, endDate),
      ),
    );
}

/**
 * Get all entries for a user in a date range (for streaks / analytics across months).
 */
export async function getEntriesByUserAndDateRange(
  userId: string,
  startDate: string,
  endDate: string,
) {
  return db
    .select()
    .from(habitEntries)
    .where(
      and(
        eq(habitEntries.userId, userId),
        gte(habitEntries.date, startDate),
        lte(habitEntries.date, endDate),
      ),
    );
}

/** Only the fields needed for streaks, through the selected month cutoff. */
export async function getActiveHabitCompletionsThrough(userId: string, cutoff: string) {
  const [entries, revisions] = await Promise.all([
    db
      .select({
        habitId: habitEntries.habitId,
        dates: sql<string[]>`array_agg(${habitEntries.date}::text)`,
        startDate: habits.startDate,
        endDate: habits.endDate,
        schedule: habits.schedule,
        archived: habits.archived,
      })
      .from(habitEntries)
      .innerJoin(habits, and(eq(habitEntries.habitId, habits.id), eq(habits.userId, userId)))
      .where(
        and(
          eq(habitEntries.userId, userId),
          eq(habitEntries.completed, true),
          lte(habitEntries.date, cutoff),
        ),
      )
      .groupBy(habitEntries.habitId, habits.id),
    getHabitScheduleRevisions(userId),
  ]);
  const revisionsByHabit = new Map<string, typeof revisions>();
  for (const revision of revisions) {
    const group = revisionsByHabit.get(revision.habitId) ?? [];
    group.push(revision);
    revisionsByHabit.set(revision.habitId, group);
  }
  // Send habit metadata once per habit rather than once per historical day.
  // Expand in memory so streak eligibility keeps using the same schedule rules.
  return entries.flatMap(({ dates, ...habit }) => {
    const scheduleRevisions = revisionsByHabit.get(habit.habitId) ?? [];
    return dates.map((date) => ({ ...habit, date, scheduleRevisions }));
  });
}

/**
 * Upsert a habit entry (insert or update on conflict).
 * The UNIQUE constraint is on (habit_id, date).
 */
export async function upsertHabitEntry(
  userId: string,
  habitId: string,
  date: string,
  completed: boolean,
) {
  const result = await db
    .insert(habitEntries)
    .values({ userId, habitId, date, completed })
    .onConflictDoUpdate({
      target: [habitEntries.habitId, habitEntries.date],
      set: { completed, updatedAt: new Date() },
    })
    .returning();
  return result[0];
}

/**
 * Delete a habit entry (mark as not completed by removing the row).
 */
export async function deleteHabitEntry(userId: string, habitId: string, date: string) {
  await db
    .delete(habitEntries)
    .where(
      and(
        eq(habitEntries.userId, userId),
        eq(habitEntries.habitId, habitId),
        eq(habitEntries.date, date),
      ),
    );
}
