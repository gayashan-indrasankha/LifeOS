import { eq, and, asc, gte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { dayPlans, habitScheduleRevisions, habits, lifeOsSeedItems } from '@/lib/db/schema';
import type { HabitCreateInput, HabitUpdateInput } from '@/lib/validations/habit';
import { habitRuleOn } from '@/lib/analytics/habit-month-progress';

async function withRevisions(userId: string, activeOnly: boolean) {
  const [rows, revisions] = await Promise.all([
    db
      .select()
      .from(habits)
      .where(
        activeOnly
          ? and(eq(habits.userId, userId), eq(habits.archived, false))
          : eq(habits.userId, userId),
      )
      .orderBy(asc(habits.sortOrder), asc(habits.createdAt)),
    db.select().from(habitScheduleRevisions).where(eq(habitScheduleRevisions.userId, userId)),
  ]);
  return rows.map((habit) => ({
    ...habit,
    scheduleRevisions: revisions.filter((revision) => revision.habitId === habit.id),
  }));
}

export const getHistoricalHabitsByUser = (userId: string) => withRevisions(userId, false);

/**
 * Get all active (non-archived) habits for a user, ordered by sort_order.
 */
export const getActiveHabitsByUser = (userId: string) => withRevisions(userId, true);

/**
 * Get all habits (including archived) for a user.
 */
export async function getAllHabitsByUser(userId: string) {
  return db
    .select()
    .from(habits)
    .where(eq(habits.userId, userId))
    .orderBy(asc(habits.archived), asc(habits.sortOrder), asc(habits.createdAt));
}

/**
 * Get a single habit by ID, scoped to the user.
 */
export async function getHabitByIdAndUser(habitId: string, userId: string) {
  const result = await db
    .select()
    .from(habits)
    .where(and(eq(habits.id, habitId), eq(habits.userId, userId)))
    .limit(1);
  if (!result[0]) return null;
  const revisions = await db
    .select()
    .from(habitScheduleRevisions)
    .where(
      and(eq(habitScheduleRevisions.habitId, habitId), eq(habitScheduleRevisions.userId, userId)),
    );
  return { ...result[0], scheduleRevisions: revisions };
}

/**
 * Create a new habit for a user.
 */
export async function createHabit(userId: string, input: HabitCreateInput) {
  return db.transaction(async (tx) => {
    const [habit] = await tx
      .insert(habits)
      .values({
        userId,
        name: input.name,
        description: input.description || null,
        icon: input.icon || null,
        category: input.category || null,
        monthlyTarget: input.monthlyTarget,
        schedule: input.schedule,
        startDate: input.startDate,
        endDate: input.endDate || null,
      })
      .returning();
    await tx.insert(habitScheduleRevisions).values({
      userId,
      habitId: habit.id,
      effectiveDate: input.startDate,
      schedule: input.schedule,
      startDate: input.startDate,
      endDate: input.endDate || null,
      status: 'active',
    });
    return habit;
  });
}

/**
 * Update an existing habit (scoped to user).
 */
export async function updateHabit(
  habitId: string,
  userId: string,
  input: HabitUpdateInput,
  effectiveDate: string,
) {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(habits)
      .where(and(eq(habits.id, habitId), eq(habits.userId, userId)))
      .limit(1);
    if (!existing || existing.archived) return null;
    const schedule = input.schedule ?? existing.schedule;
    const startDate = input.startDate ?? existing.startDate;
    const endDate = input.endDate === undefined ? existing.endDate : input.endDate || null;
    if (
      schedule !== existing.schedule ||
      startDate !== existing.startDate ||
      endDate !== existing.endDate
    ) {
      await tx
        .insert(habitScheduleRevisions)
        .values({
          userId,
          habitId,
          effectiveDate,
          schedule,
          startDate,
          endDate,
          status: 'active',
        })
        .onConflictDoUpdate({
          target: [habitScheduleRevisions.habitId, habitScheduleRevisions.effectiveDate],
          set: { schedule, startDate, endDate, status: 'active', source: 'recorded' },
        });
    }
    const [updated] = await tx
      .update(habits)
      .set({
        ...input,
        ...(input.description !== undefined ? { description: input.description || null } : {}),
        ...(input.icon !== undefined ? { icon: input.icon || null } : {}),
        ...(input.category !== undefined ? { category: input.category || null } : {}),
        ...(input.endDate !== undefined ? { endDate } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(habits.id, habitId), eq(habits.userId, userId)))
      .returning();
    return updated;
  });
}

/**
 * Archive (soft-delete) a habit.
 */
async function setArchived(
  habitId: string,
  userId: string,
  archived: boolean,
  effectiveDate: string,
) {
  return db.transaction(async (tx) => {
    const [habit] = await tx
      .select()
      .from(habits)
      .where(and(eq(habits.id, habitId), eq(habits.userId, userId)))
      .limit(1);
    if (!habit) return null;
    if (habit.archived === archived) return habit;
    const revisions = await tx
      .select()
      .from(habitScheduleRevisions)
      .where(
        and(eq(habitScheduleRevisions.habitId, habitId), eq(habitScheduleRevisions.userId, userId)),
      );
    const current = habitRuleOn({ ...habit, scheduleRevisions: revisions }, effectiveDate);
    const schedule = current?.schedule ?? habit.schedule;
    const startDate = current?.startDate ?? habit.startDate;
    const endDate = current?.endDate ?? habit.endDate;
    await tx
      .insert(habitScheduleRevisions)
      .values({
        userId,
        habitId,
        effectiveDate,
        schedule,
        startDate,
        endDate,
        status: archived ? 'archived' : 'active',
      })
      .onConflictDoUpdate({
        target: [habitScheduleRevisions.habitId, habitScheduleRevisions.effectiveDate],
        set: { status: archived ? 'archived' : 'active' },
      });
    await tx
      .update(habitScheduleRevisions)
      .set({ status: archived ? 'archived' : 'active' })
      .where(
        and(
          eq(habitScheduleRevisions.habitId, habitId),
          eq(habitScheduleRevisions.userId, userId),
          gte(habitScheduleRevisions.effectiveDate, effectiveDate),
        ),
      );
    const [updated] = await tx
      .update(habits)
      .set({ archived, updatedAt: new Date() })
      .where(and(eq(habits.id, habitId), eq(habits.userId, userId)))
      .returning();
    return updated;
  });
}

export const archiveHabit = (habitId: string, userId: string, effectiveDate: string) =>
  setArchived(habitId, userId, true, effectiveDate);

/**
 * Unarchive a habit.
 */
export const unarchiveHabit = (habitId: string, userId: string, effectiveDate: string) =>
  setArchived(habitId, userId, false, effectiveDate);

/** Permanently remove an owned habit and its history. Preserve preset deletion intent. */
export async function deleteHabit(habitId: string, userId: string) {
  return db.transaction(async (tx) => {
    const [habit] = await tx
      .select({ id: habits.id, templateKey: habits.templateKey })
      .from(habits)
      .where(and(eq(habits.id, habitId), eq(habits.userId, userId)))
      .limit(1);
    if (!habit) return null;

    await tx
      .update(dayPlans)
      .set({ minimumHabitId: null, updatedAt: new Date() })
      .where(and(eq(dayPlans.userId, userId), eq(dayPlans.minimumHabitId, habitId)));
    if (habit.templateKey) {
      await tx
        .insert(lifeOsSeedItems)
        .values({ userId, itemType: 'Habit', templateKey: habit.templateKey })
        .onConflictDoNothing();
    }
    const [deleted] = await tx
      .delete(habits)
      .where(and(eq(habits.id, habitId), eq(habits.userId, userId)))
      .returning({ id: habits.id });
    return deleted ?? null;
  });
}

/**
 * Reorder habits by updating sort_order.
 */
export async function reorderHabits(userId: string, orderedIds: string[]) {
  if (new Set(orderedIds).size !== orderedIds.length) throw new Error('Invalid habit order');
  await db.transaction(async (tx) => {
    const owned = await tx
      .select({ id: habits.id })
      .from(habits)
      .where(and(eq(habits.userId, userId), eq(habits.archived, false)));
    if (owned.length !== orderedIds.length || owned.some(({ id }) => !orderedIds.includes(id)))
      throw new Error('Invalid habit order');
    for (const [index, id] of orderedIds.entries()) {
      await tx
        .update(habits)
        .set({ sortOrder: index, updatedAt: new Date() })
        .where(and(eq(habits.id, id), eq(habits.userId, userId)));
    }
  });
}
