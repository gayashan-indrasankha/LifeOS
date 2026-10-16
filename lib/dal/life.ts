import { and, asc, desc, eq, getTableColumns, gte, lte, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  dayPlans,
  goals,
  metricEntries,
  projects,
  subjectAssessments,
  subjects,
  tasks,
  taskChecklistCompletions,
  taskCompletions,
  timeBlockExceptions,
  timeBlockRevisions,
  timeBlocks,
  weeklyReviews,
} from '@/lib/db/schema';

export const getGoals = (userId: string) =>
  db
    .select()
    .from(goals)
    .where(eq(goals.userId, userId))
    .orderBy(asc(goals.priority), asc(goals.createdAt));
export const getProjects = (userId: string) =>
  db.select().from(projects).where(eq(projects.userId, userId)).orderBy(asc(projects.createdAt));
export const getTasks = (userId: string, options: { includeChecklists?: boolean } = {}) =>
  db
    .select({
      ...getTableColumns(tasks),
      checklist: options.includeChecklists === false ? sql<string | null>`null` : tasks.checklist,
    })
    .from(tasks)
    .where(eq(tasks.userId, userId))
    .orderBy(asc(tasks.status), asc(tasks.sortOrder), asc(tasks.createdAt));
export const getTaskCompletionKeys = async (userId: string, start: string, end: string) => {
  const rows = await db
    .select({ taskId: taskCompletions.taskId, date: taskCompletions.date })
    .from(taskCompletions)
    .where(
      and(
        eq(taskCompletions.userId, userId),
        gte(taskCompletions.date, start),
        lte(taskCompletions.date, end),
      ),
    );
  return new Set(rows.map((row) => `${row.taskId}:${row.date}`));
};
export const getTaskChecklistDoneByDate = async (userId: string, start: string, end: string) => {
  const rows = await db
    .select({
      taskId: taskChecklistCompletions.taskId,
      itemId: taskChecklistCompletions.itemId,
      date: taskChecklistCompletions.date,
    })
    .from(taskChecklistCompletions)
    .where(
      and(
        eq(taskChecklistCompletions.userId, userId),
        gte(taskChecklistCompletions.date, start),
        lte(taskChecklistCompletions.date, end),
      ),
    );
  const byTaskDate: Record<string, string[]> = {};
  for (const row of rows) {
    const key = `${row.taskId}:${row.date}`;
    (byTaskDate[key] ??= []).push(row.itemId);
  }
  return byTaskDate;
};
export const getSubjects = (userId: string) =>
  db.select().from(subjects).where(eq(subjects.userId, userId)).orderBy(asc(subjects.slot));
export const getAssessments = (userId: string) =>
  db
    .select()
    .from(subjectAssessments)
    .where(eq(subjectAssessments.userId, userId))
    .orderBy(asc(subjectAssessments.dueDate));
export const getMetrics = (userId: string, type?: string) =>
  db
    .select()
    .from(metricEntries)
    .where(
      type
        ? and(eq(metricEntries.userId, userId), eq(metricEntries.type, type))
        : eq(metricEntries.userId, userId),
    )
    .orderBy(desc(metricEntries.date), desc(metricEntries.createdAt));
export const getReview = async (userId: string, weekStart: string) =>
  (
    await db
      .select()
      .from(weeklyReviews)
      .where(and(eq(weeklyReviews.userId, userId), eq(weeklyReviews.weekStart, weekStart)))
      .limit(1)
  )[0] ?? null;
export const getDayPlan = async (userId: string, date: string) =>
  (
    await db
      .select()
      .from(dayPlans)
      .where(and(eq(dayPlans.userId, userId), eq(dayPlans.date, date)))
      .limit(1)
  )[0] ?? null;

export async function getBlocksForRange(userId: string, start: string, end: string) {
  const [rules, exceptions, revisions] = await Promise.all([
    db.select().from(timeBlocks).where(eq(timeBlocks.userId, userId)),
    db
      .select()
      .from(timeBlockExceptions)
      .where(
        and(
          eq(timeBlockExceptions.userId, userId),
          or(
            and(
              gte(timeBlockExceptions.occurrenceDate, start),
              lte(timeBlockExceptions.occurrenceDate, end),
            ),
            and(
              gte(timeBlockExceptions.overrideDate, start),
              lte(timeBlockExceptions.overrideDate, end),
            ),
          ),
        ),
      ),
    db.select().from(timeBlockRevisions).where(eq(timeBlockRevisions.userId, userId)),
  ]);
  return { rules, exceptions, revisions };
}
