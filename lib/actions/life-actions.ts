'use server';

import { and, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import {
  dayPlans,
  goals,
  milestoneCriteria,
  milestoneReviewHistory,
  milestoneReviews,
  metricEntries,
  projects,
  subjectAssessments,
  subjects,
  tasks,
  taskCompletions,
  timeBlockExceptions,
  timeBlockRevisions,
  timeBlocks,
  users,
  weeklyReviews,
} from '@/lib/db/schema';
import { getUserSettings } from '@/lib/dal/user-settings';
import { getReview } from '@/lib/dal/life';
import { getTodayInTimezone, serverNow, toDateString } from '@/lib/utils/date';
import {
  expandBlocks,
  futureBoundaryDates,
  occursOn,
  overlaps,
  ruleOn,
  sameOccurrence,
  weekdayIndex,
} from '@/lib/planning/time-blocks';
import { scheduledInstant, statusTimeError } from '@/lib/planning/occurrence-time';
import { planPriorityOrder } from '@/lib/planning/priorities';
import { occursOn as taskOccursOn } from '@/lib/planning/task-recurrence';
import { checklistActiveOn, checklistFromForm, readChecklist } from '@/lib/planning/task-checklist';
import {
  BlockSchema,
  DayModeSchema,
  ExceptionSchema,
  GoalSchema,
  MetricSchema,
  ProjectSchema,
  SubjectSchema,
  TaskSchema,
} from '@/lib/validations/life';

export type LifeActionState = { error?: string; success?: string };
const fail = (error: string): LifeActionState => ({ error });
const invalid = (error: z.ZodError): LifeActionState =>
  fail(error.issues[0]?.message ?? 'Check the form fields.');
function refresh() {
  for (const route of ['/dashboard', '/today', '/week', '/goals', '/review']) revalidatePath(route);
}
const nullable = (form: FormData, key: string) => String(form.get(key) ?? '');
const checked = (form: FormData, key: string) => form.get(key) === 'on';
const weekdays = (form: FormData) =>
  form.has('weekdaySelection')
    ? Array.from({ length: 7 }, (_, index) =>
        form.getAll('weekday').includes(String(index)) ? '1' : '0',
      ).join('')
    : nullable(form, 'weekdayMask');

export async function createGoalAction(
  _: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const parsed = GoalSchema.safeParse({
    area: nullable(form, 'area'),
    title: nullable(form, 'title'),
    description: nullable(form, 'description'),
    targetDate: nullable(form, 'targetDate'),
    priority: nullable(form, 'priority'),
    targetValue: nullable(form, 'targetValue'),
    targetUnit: nullable(form, 'targetUnit'),
  });
  if (!parsed.success) return invalid(parsed.error);
  await db.insert(goals).values({ userId, ...parsed.data });
  refresh();
  return { success: 'Goal created.' };
}

export async function createProjectAction(
  _: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const parsed = ProjectSchema.safeParse({
    name: nullable(form, 'name'),
    description: nullable(form, 'description'),
    type: nullable(form, 'type'),
    goalId: nullable(form, 'goalId'),
    deadline: nullable(form, 'deadline'),
    repositoryUrl: nullable(form, 'repositoryUrl'),
  });
  if (!parsed.success) return invalid(parsed.error);
  if (
    parsed.data.goalId &&
    !(
      await db
        .select({ id: goals.id })
        .from(goals)
        .where(and(eq(goals.id, parsed.data.goalId), eq(goals.userId, userId)))
        .limit(1)
    )[0]
  )
    return fail('Goal not found.');
  await db.insert(projects).values({ userId, ...parsed.data });
  refresh();
  return { success: 'Project created.' };
}

export async function editGoalAction(_: LifeActionState, form: FormData): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const id = z.uuid().safeParse(form.get('id'));
  if (!id.success) return fail('Goal not found.');
  const [current] = await db
    .select()
    .from(goals)
    .where(and(eq(goals.userId, userId), eq(goals.id, id.data)))
    .limit(1);
  if (!current) return fail('Goal not found.');
  const field = (key: string, saved: string | number | null) =>
    form.has(key) ? nullable(form, key) : String(saved ?? '');
  const parsed = GoalSchema.safeParse({
    area: field('area', current.area),
    title: field('title', current.title),
    description: field('description', current.description),
    targetDate: field('targetDate', current.targetDate),
    priority: field('priority', current.priority),
    targetValue: field('targetValue', current.targetValue),
    targetUnit: field('targetUnit', current.targetUnit),
  });
  const status = z
    .enum(['active', 'paused', 'completed', 'cancelled'])
    .safeParse(form.has('status') ? form.get('status') : current.status);
  if (!parsed.success) return invalid(parsed.error);
  if (!status.success) return invalid(status.error);
  await db
    .update(goals)
    .set({ ...parsed.data, status: status.data, updatedAt: new Date() })
    .where(and(eq(goals.userId, userId), eq(goals.id, id.data)));
  refresh();
  return { success: 'Goal saved.' };
}

export async function deleteGoalAction(
  _: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const id = z.uuid().safeParse(form.get('id'));
  if (!id.success) return fail('Goal not found.');

  try {
    const result = await db.transaction(async (tx) => {
      const [goal] = await tx
        .select({ id: goals.id })
        .from(goals)
        .where(and(eq(goals.userId, userId), eq(goals.id, id.data)))
        .for('update');
      if (!goal) return 'missing';

      const [linkedTask] = await tx
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.userId, userId), eq(tasks.goalId, goal.id)))
        .limit(1);
      if (linkedTask) return 'linked';
      const [linkedProject] = await tx
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.userId, userId), eq(projects.goalId, goal.id)))
        .limit(1);
      if (linkedProject) return 'linked';
      const [linkedBlock] = await tx
        .select({ id: timeBlocks.id })
        .from(timeBlocks)
        .where(and(eq(timeBlocks.userId, userId), eq(timeBlocks.goalId, goal.id)))
        .limit(1);
      if (linkedBlock) return 'linked';
      const [linkedRevision] = await tx
        .select({ id: timeBlockRevisions.id })
        .from(timeBlockRevisions)
        .where(and(eq(timeBlockRevisions.userId, userId), eq(timeBlockRevisions.goalId, goal.id)))
        .limit(1);
      if (linkedRevision) return 'linked';

      await tx.delete(goals).where(and(eq(goals.userId, userId), eq(goals.id, goal.id)));
      return 'deleted';
    });
    if (result === 'missing') return fail('Goal not found.');
    if (result === 'linked')
      return fail(
        'This goal has linked work. Reassign its tasks, projects, or schedule before deleting it.',
      );
  } catch {
    return fail('Could not delete this goal. Check for linked work and try again.');
  }

  refresh();
  return { success: 'Goal deleted.' };
}

export async function editProjectAction(
  _: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const id = z.uuid().safeParse(form.get('id'));
  if (!id.success) return fail('Project not found.');
  const [current] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.userId, userId), eq(projects.id, id.data)))
    .limit(1);
  if (!current) return fail('Project not found.');
  const field = (key: string, saved: string | null) =>
    form.has(key) ? nullable(form, key) : (saved ?? '');
  const parsed = ProjectSchema.safeParse({
    name: field('name', current.name),
    description: field('description', current.description),
    type: field('type', current.type),
    goalId: field('goalId', current.goalId),
    deadline: field('deadline', current.deadline),
    repositoryUrl: field('repositoryUrl', current.repositoryUrl),
  });
  const status = z
    .enum(['active', 'paused', 'completed', 'cancelled'])
    .safeParse(form.has('status') ? form.get('status') : current.status);
  if (!parsed.success) return invalid(parsed.error);
  if (!status.success) return invalid(status.error);
  if (
    parsed.data.goalId &&
    !(
      await db
        .select({ id: goals.id })
        .from(goals)
        .where(and(eq(goals.userId, userId), eq(goals.id, parsed.data.goalId)))
        .limit(1)
    )[0]
  )
    return fail('Goal not found.');
  await db
    .update(projects)
    .set({ ...parsed.data, status: status.data, updatedAt: new Date() })
    .where(and(eq(projects.userId, userId), eq(projects.id, id.data)));
  refresh();
  return { success: 'Project saved.' };
}

export async function setGoalArchiveAction(
  _: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const parsed = z
    .object({ id: z.uuid(), archive: z.enum(['yes', 'no']) })
    .safeParse({ id: form.get('id'), archive: form.get('archive') });
  if (!parsed.success) return invalid(parsed.error);
  if (parsed.data.archive === 'yes' && form.get('confirm') !== 'yes')
    return fail('Confirm archiving this goal.');
  const changed = await db
    .update(goals)
    .set({ archivedAt: parsed.data.archive === 'yes' ? new Date() : null, updatedAt: new Date() })
    .where(and(eq(goals.userId, userId), eq(goals.id, parsed.data.id)))
    .returning({ id: goals.id });
  if (!changed.length) return fail('Goal not found.');
  refresh();
  return { success: parsed.data.archive === 'yes' ? 'Goal archived.' : 'Goal restored.' };
}

export async function setProjectArchiveAction(
  _: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const parsed = z
    .object({ id: z.uuid(), archive: z.enum(['yes', 'no']) })
    .safeParse({ id: form.get('id'), archive: form.get('archive') });
  if (!parsed.success) return invalid(parsed.error);
  if (parsed.data.archive === 'yes' && form.get('confirm') !== 'yes')
    return fail('Confirm archiving this project.');
  const changed = await db
    .update(projects)
    .set({ archivedAt: parsed.data.archive === 'yes' ? new Date() : null, updatedAt: new Date() })
    .where(and(eq(projects.userId, userId), eq(projects.id, parsed.data.id)))
    .returning({ id: projects.id });
  if (!changed.length) return fail('Project not found.');
  refresh();
  return { success: parsed.data.archive === 'yes' ? 'Project archived.' : 'Project restored.' };
}

export async function updateGoalStatusAction(
  _: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const parsed = z
    .object({ id: z.uuid(), status: z.enum(['active', 'paused', 'completed', 'cancelled']) })
    .safeParse({ id: form.get('id'), status: form.get('status') });
  if (!parsed.success) return invalid(parsed.error);
  const changed = await db
    .update(goals)
    .set({ status: parsed.data.status, updatedAt: new Date() })
    .where(and(eq(goals.userId, userId), eq(goals.id, parsed.data.id)))
    .returning({ id: goals.id });
  if (!changed.length) return fail('Goal not found.');
  refresh();
  return { success: 'Goal updated.' };
}

export async function updateProjectStatusAction(
  _: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const parsed = z
    .object({ id: z.uuid(), status: z.enum(['active', 'paused', 'completed', 'cancelled']) })
    .safeParse({ id: form.get('id'), status: form.get('status') });
  if (!parsed.success) return invalid(parsed.error);
  const changed = await db
    .update(projects)
    .set({ status: parsed.data.status, updatedAt: new Date() })
    .where(and(eq(projects.userId, userId), eq(projects.id, parsed.data.id)))
    .returning({ id: projects.id });
  if (!changed.length) return fail('Project not found.');
  refresh();
  return { success: 'Project updated.' };
}

export async function createTaskAction(
  _: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const parsed = TaskSchema.safeParse({
    title: nullable(form, 'title'),
    details: nullable(form, 'details'),
    area: nullable(form, 'area'),
    priority: nullable(form, 'priority'),
    estimatedMinutes: nullable(form, 'estimatedMinutes'),
    dueDate: nullable(form, 'dueDate'),
    scheduledDate: nullable(form, 'scheduledDate'),
    recurrence: nullable(form, 'recurrence') || 'once',
    weekdays: form.has('weekdaySelection') ? weekdays(form) : null,
    goalId: nullable(form, 'goalId'),
    projectId: nullable(form, 'projectId'),
    isMilestone: checked(form, 'isMilestone'),
  });
  if (!parsed.success) return invalid(parsed.error);
  const checklist = checklistFromForm(
    checked(form, 'checklistEnabled'),
    nullable(form, 'checklistItems'),
  );
  if (checklist.error) return fail(checklist.error);
  if (checklist.items.length && (!parsed.data.scheduledDate || !parsed.data.dueDate))
    return fail('Checklist tasks need a start date and an end date.');
  const { goalId, projectId } = parsed.data;
  if (
    goalId &&
    !(
      await db
        .select({ id: goals.id })
        .from(goals)
        .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
        .limit(1)
    )[0]
  )
    return fail('Goal not found.');
  if (
    projectId &&
    !(
      await db
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
        .limit(1)
    )[0]
  )
    return fail('Project not found.');
  await db.insert(tasks).values({
    userId,
    ...parsed.data,
    checklist: checklist.items.length ? JSON.stringify(checklist.items) : null,
  });
  refresh();
  return { success: 'Task added.' };
}

export async function deleteTaskAction(
  _: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const parsed = z.uuid().safeParse(form.get('id'));
  if (!parsed.success) return fail('Choose a valid task to delete.');

  try {
    const result = await db.transaction(async (tx) => {
      await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for('update');
      const [task] = await tx
        .select()
        .from(tasks)
        .where(and(eq(tasks.userId, userId), eq(tasks.id, parsed.data)))
        .limit(1);
      if (!task) return 'missing';
      if (
        !['todo', 'in_progress'].includes(task.status) ||
        task.completedAt ||
        task.actualMinutes !== null
      )
        return 'has-history';

      const [criteria, review, reviewHistory] = await Promise.all([
        tx
          .select({ id: milestoneCriteria.id })
          .from(milestoneCriteria)
          .where(and(eq(milestoneCriteria.userId, userId), eq(milestoneCriteria.taskId, task.id)))
          .limit(1),
        tx
          .select({ id: milestoneReviews.id })
          .from(milestoneReviews)
          .where(and(eq(milestoneReviews.userId, userId), eq(milestoneReviews.taskId, task.id)))
          .limit(1),
        tx
          .select({ id: milestoneReviewHistory.id })
          .from(milestoneReviewHistory)
          .where(
            and(
              eq(milestoneReviewHistory.userId, userId),
              eq(milestoneReviewHistory.taskId, task.id),
            ),
          )
          .limit(1),
      ]);
      if (criteria.length || review.length || reviewHistory.length) return 'has-history';

      await tx.delete(tasks).where(and(eq(tasks.userId, userId), eq(tasks.id, task.id)));
      if (task.dailyPriority && task.scheduledDate) {
        const remaining = await tx
          .select({ id: tasks.id, dailyPriority: tasks.dailyPriority })
          .from(tasks)
          .where(
            and(
              eq(tasks.userId, userId),
              eq(tasks.scheduledDate, task.scheduledDate),
              isNotNull(tasks.dailyPriority),
            ),
          );
        remaining.sort((first, second) => (first.dailyPriority ?? 9) - (second.dailyPriority ?? 9));
        await tx
          .update(tasks)
          .set({ dailyPriority: null })
          .where(
            and(
              eq(tasks.userId, userId),
              eq(tasks.scheduledDate, task.scheduledDate),
              isNotNull(tasks.dailyPriority),
            ),
          );
        for (let index = 0; index < remaining.length; index++) {
          await tx
            .update(tasks)
            .set({ dailyPriority: index + 1 })
            .where(and(eq(tasks.userId, userId), eq(tasks.id, remaining[index].id)));
        }
      }
      return 'deleted';
    });
    if (result === 'missing') return fail('Task not found. Refresh and try again.');
    if (result === 'has-history')
      return fail('This task has recorded work or review history and cannot be deleted.');
  } catch {
    return fail('This task is linked to another record. Unlink it there before deleting.');
  }

  refresh();
  revalidatePath('/goals/evidence');
  return { success: 'Task deleted.' };
}

export async function planUnscheduledTaskAction(
  _: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const parsed = z
    .object({ id: z.uuid(), date: z.iso.date() })
    .safeParse({ id: form.get('id'), date: form.get('date') });
  if (!parsed.success) return fail('Choose a task and a day.');
  const changed = await db
    .update(tasks)
    .set({ scheduledDate: parsed.data.date, updatedAt: new Date() })
    .where(
      and(
        eq(tasks.userId, userId),
        eq(tasks.id, parsed.data.id),
        isNull(tasks.scheduledDate),
        inArray(tasks.status, ['todo', 'in_progress']),
      ),
    )
    .returning({ id: tasks.id });
  if (!changed.length) return fail('This task was already planned or is no longer available.');
  refresh();
  return { success: 'Task added to the week.' };
}

export async function editTaskAction(_: LifeActionState, form: FormData): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const id = z.uuid().safeParse(form.get('id'));
  const parsed = TaskSchema.safeParse({
    title: nullable(form, 'title'),
    details: nullable(form, 'details'),
    area: nullable(form, 'area'),
    priority: nullable(form, 'priority'),
    estimatedMinutes: nullable(form, 'estimatedMinutes'),
    dueDate: nullable(form, 'dueDate'),
    scheduledDate: nullable(form, 'scheduledDate'),
    recurrence: nullable(form, 'recurrence') || 'once',
    weekdays: form.has('weekdaySelection') ? weekdays(form) : null,
    goalId: nullable(form, 'goalId'),
    projectId: nullable(form, 'projectId'),
    isMilestone: checked(form, 'isMilestone'),
  });
  if (!id.success || !parsed.success) return fail('Check the task fields.');
  const current = (
    await db
      .select({ scheduledDate: tasks.scheduledDate })
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.id, id.data)))
      .limit(1)
  )[0];
  if (!current) return fail('Task not found.');
  const draftChecklist = checklistFromForm(
    checked(form, 'checklistEnabled'),
    nullable(form, 'checklistItems'),
  );
  if (draftChecklist.error) return fail(draftChecklist.error);
  if (draftChecklist.items.length && (!parsed.data.scheduledDate || !parsed.data.dueDate))
    return fail('Checklist tasks need a start date and an end date.');
  if (
    parsed.data.goalId &&
    !(
      await db
        .select({ id: goals.id })
        .from(goals)
        .where(and(eq(goals.id, parsed.data.goalId), eq(goals.userId, userId)))
        .limit(1)
    )[0]
  )
    return fail('Goal not found.');
  if (
    parsed.data.projectId &&
    !(
      await db
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.id, parsed.data.projectId), eq(projects.userId, userId)))
        .limit(1)
    )[0]
  )
    return fail('Project not found.');
  try {
    await db.transaction(async (tx) => {
      await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for('update');
      const [locked] = await tx
        .select()
        .from(tasks)
        .where(and(eq(tasks.userId, userId), eq(tasks.id, id.data)))
        .limit(1);
      if (!locked) throw new Error('missing');
      const checklist = checklistFromForm(
        checked(form, 'checklistEnabled'),
        nullable(form, 'checklistItems'),
        readChecklist(locked.checklist),
      );
      const changedDate =
        parsed.data.scheduledDate !== locked.scheduledDate ||
        parsed.data.recurrence !== locked.recurrence;
      await tx
        .update(tasks)
        .set({
          ...parsed.data,
          checklist: checklist.items.length ? JSON.stringify(checklist.items) : null,
          ...(parsed.data.recurrence !== 'once' ? { status: 'todo', completedAt: null } : {}),
          ...(changedDate ? { dailyPriority: null } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(tasks.userId, userId), eq(tasks.id, id.data)));
      if (changedDate && locked.scheduledDate && locked.dailyPriority) {
        const remaining = await tx
          .select()
          .from(tasks)
          .where(
            and(
              eq(tasks.userId, userId),
              eq(tasks.scheduledDate, locked.scheduledDate),
              isNotNull(tasks.dailyPriority),
            ),
          );
        remaining.sort((a, b) => (a.dailyPriority ?? 9) - (b.dailyPriority ?? 9));
        await tx
          .update(tasks)
          .set({ dailyPriority: null })
          .where(
            and(
              eq(tasks.userId, userId),
              eq(tasks.scheduledDate, locked.scheduledDate),
              isNotNull(tasks.dailyPriority),
            ),
          );
        for (let index = 0; index < remaining.length; index++)
          await tx
            .update(tasks)
            .set({ dailyPriority: index + 1 })
            .where(and(eq(tasks.userId, userId), eq(tasks.id, remaining[index].id)));
      }
    });
  } catch {
    return fail('Could not edit this task. Refresh and try again.');
  }
  refresh();
  return { success: 'Task edited.' };
}

export async function updateTaskAction(
  _: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const parsed = z
    .object({
      id: z.uuid(),
      status: z.enum(['todo', 'in_progress', 'done', 'cancelled']),
      scheduledDate: z.union([z.iso.date(), z.literal('')]).optional(),
      actualMinutes: z.union([z.literal(''), z.coerce.number().int().min(0).max(1440)]).optional(),
    })
    .safeParse({
      id: form.get('id'),
      status: form.get('status'),
      scheduledDate: form.get('scheduledDate') ?? undefined,
      actualMinutes: form.get('actualMinutes') ?? undefined,
    });
  if (!parsed.success) return invalid(parsed.error);
  try {
    await db.transaction(async (tx) => {
      await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for('update');
      const [previous] = await tx
        .select()
        .from(tasks)
        .where(and(eq(tasks.userId, userId), eq(tasks.id, parsed.data.id)))
        .limit(1);
      if (!previous) throw new Error('missing');
      if (
        previous.recurrence !== 'once' &&
        (parsed.data.status === 'done' ||
          parsed.data.scheduledDate !== undefined ||
          parsed.data.actualMinutes !== undefined)
      )
        throw new Error('recurring');
      const changedDate =
        parsed.data.scheduledDate !== undefined &&
        (parsed.data.scheduledDate || null) !== previous.scheduledDate;
      await tx
        .update(tasks)
        .set({
          status: parsed.data.status,
          ...(parsed.data.scheduledDate !== undefined
            ? {
                scheduledDate: parsed.data.scheduledDate || null,
                ...(changedDate ? { dailyPriority: null } : {}),
              }
            : {}),
          ...(parsed.data.actualMinutes !== undefined
            ? { actualMinutes: parsed.data.actualMinutes === '' ? null : parsed.data.actualMinutes }
            : {}),
          completedAt: parsed.data.status === 'done' ? (previous.completedAt ?? new Date()) : null,
          updatedAt: new Date(),
        })
        .where(and(eq(tasks.userId, userId), eq(tasks.id, parsed.data.id)));
      if (changedDate && previous.scheduledDate && previous.dailyPriority) {
        const remaining = await tx
          .select()
          .from(tasks)
          .where(
            and(
              eq(tasks.userId, userId),
              eq(tasks.scheduledDate, previous.scheduledDate),
              isNotNull(tasks.dailyPriority),
            ),
          );
        remaining.sort((a, b) => (a.dailyPriority ?? 9) - (b.dailyPriority ?? 9));
        await tx
          .update(tasks)
          .set({ dailyPriority: null })
          .where(
            and(
              eq(tasks.userId, userId),
              eq(tasks.scheduledDate, previous.scheduledDate),
              isNotNull(tasks.dailyPriority),
            ),
          );
        for (let index = 0; index < remaining.length; index++)
          await tx
            .update(tasks)
            .set({ dailyPriority: index + 1 })
            .where(and(eq(tasks.userId, userId), eq(tasks.id, remaining[index].id)));
      }
    });
  } catch {
    return fail('Could not update this task. Refresh and try again.');
  }
  refresh();
  return { success: 'Task updated.' };
}

export async function toggleTaskOccurrenceAction(
  _: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const parsed = z
    .object({
      id: z.uuid(),
      date: z.iso.date(),
      completed: z.enum(['yes', 'no']),
    })
    .safeParse({ id: form.get('id'), date: form.get('date'), completed: form.get('completed') });
  if (!parsed.success) return invalid(parsed.error);
  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.id, parsed.data.id)))
    .limit(1);
  if (
    !task ||
    task.status === 'cancelled' ||
    task.recurrence === 'once' ||
    !taskOccursOn(task, parsed.data.date)
  )
    return fail('This task is not scheduled for that day.');
  if (parsed.data.completed === 'yes') {
    await db
      .insert(taskCompletions)
      .values({ userId, taskId: task.id, date: parsed.data.date })
      .onConflictDoNothing();
  } else {
    await db
      .delete(taskCompletions)
      .where(
        and(
          eq(taskCompletions.userId, userId),
          eq(taskCompletions.taskId, task.id),
          eq(taskCompletions.date, parsed.data.date),
        ),
      );
  }
  refresh();
  return {
    success: parsed.data.completed === 'yes' ? 'Occurrence completed.' : 'Occurrence reopened.',
  };
}

export async function toggleTaskChecklistItemAction(
  _: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const parsed = z
    .object({ taskId: z.uuid(), itemId: z.uuid(), done: z.enum(['yes', 'no']) })
    .safeParse({ taskId: form.get('taskId'), itemId: form.get('itemId'), done: form.get('done') });
  if (!parsed.success) return invalid(parsed.error);
  const settings = await getUserSettings(userId);
  const today = toDateString(getTodayInTimezone(settings.timezone));
  const result = await db.transaction(async (tx) => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for('update');
    const [task] = await tx
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.id, parsed.data.taskId)))
      .limit(1);
    if (!task || !checklistActiveOn(task, today)) return 'unavailable';
    const items = readChecklist(task.checklist);
    const item = items.find((entry) => entry.id === parsed.data.itemId);
    if (!item) return 'unavailable';
    item.done = parsed.data.done === 'yes';
    await tx
      .update(tasks)
      .set({ checklist: JSON.stringify(items), updatedAt: new Date() })
      .where(and(eq(tasks.userId, userId), eq(tasks.id, task.id)));
    return 'saved';
  });
  if (result !== 'saved') return fail('This checklist item is unavailable today.');
  refresh();
  return { success: 'Checklist updated.' };
}

export async function managePriorityAction(
  _: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const parsed = z
    .object({
      id: z.uuid(),
      date: z.iso.date(),
      operation: z.enum(['assign', 'move', 'replace', 'remove']),
      rank: z.coerce.number().int().min(1).max(3).optional(),
      confirm: z.string().optional(),
    })
    .safeParse({
      id: form.get('id'),
      date: form.get('date'),
      operation: form.get('operation'),
      rank: form.get('rank') || undefined,
      confirm: form.get('confirm') || undefined,
    });
  if (!parsed.success) return invalid(parsed.error);
  if (parsed.data.operation === 'replace' && parsed.data.confirm !== 'yes')
    return fail('Confirm which priority to replace.');
  try {
    await db.transaction(async (tx) => {
      await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for('update');
      const [target] = await tx
        .select()
        .from(tasks)
        .where(and(eq(tasks.userId, userId), eq(tasks.id, parsed.data.id)))
        .limit(1);
      if (!target || (target.status === 'cancelled' && parsed.data.operation !== 'remove'))
        throw new Error('Task is unavailable.');
      const destination = await tx
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.userId, userId),
            eq(tasks.scheduledDate, parsed.data.date),
            isNotNull(tasks.dailyPriority),
          ),
        );
      const current = destination
        .sort((a, b) => (a.dailyPriority ?? 9) - (b.dailyPriority ?? 9))
        .map((item) => item.id);
      const next = planPriorityOrder(current, target.id, parsed.data.operation, parsed.data.rank);
      const sourceDate =
        target.dailyPriority && target.scheduledDate !== parsed.data.date
          ? target.scheduledDate
          : null;
      const source = sourceDate
        ? await tx
            .select()
            .from(tasks)
            .where(
              and(
                eq(tasks.userId, userId),
                eq(tasks.scheduledDate, sourceDate),
                isNotNull(tasks.dailyPriority),
              ),
            )
        : [];
      const sourceOrder = source
        .sort((a, b) => (a.dailyPriority ?? 9) - (b.dailyPriority ?? 9))
        .map((item) => item.id)
        .filter((id) => id !== target.id);
      await tx
        .update(tasks)
        .set({ dailyPriority: null })
        .where(
          and(
            eq(tasks.userId, userId),
            eq(tasks.scheduledDate, parsed.data.date),
            isNotNull(tasks.dailyPriority),
          ),
        );
      if (sourceDate)
        await tx
          .update(tasks)
          .set({ dailyPriority: null })
          .where(
            and(
              eq(tasks.userId, userId),
              eq(tasks.scheduledDate, sourceDate),
              isNotNull(tasks.dailyPriority),
            ),
          );
      for (let index = 0; index < sourceOrder.length; index++)
        await tx
          .update(tasks)
          .set({ dailyPriority: index + 1 })
          .where(and(eq(tasks.userId, userId), eq(tasks.id, sourceOrder[index])));
      for (let index = 0; index < next.length; index++)
        await tx
          .update(tasks)
          .set({
            dailyPriority: index + 1,
            ...(next[index] === target.id && parsed.data.operation !== 'remove'
              ? { scheduledDate: parsed.data.date }
              : {}),
            updatedAt: new Date(),
          })
          .where(and(eq(tasks.userId, userId), eq(tasks.id, next[index])));
    });
  } catch (error) {
    return fail(
      error instanceof Error &&
        [
          'Task is unavailable.',
          'Task is not a priority.',
          'Choose Priority 1, 2, or 3.',
          'Choose an assigned priority.',
          'This task is already a priority.',
          'Choose an empty priority slot.',
          'Choose an occupied priority to replace.',
        ].includes(error.message)
        ? error.message
        : 'Priority changed elsewhere. Refresh and try again.',
    );
  }
  refresh();
  return { success: 'Priorities saved.' };
}

export async function setDayModeAction(
  _: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const date = z.iso.date().safeParse(form.get('date'));
  const mode = DayModeSchema.safeParse(form.get('mode'));
  if (!date.success || !mode.success) return fail('Choose a valid date and day mode.');
  const settings = await getUserSettings(userId);
  if (date.data !== toDateString(getTodayInTimezone(settings.timezone)))
    return fail('Day mode can only be changed for today.');
  await db
    .insert(dayPlans)
    .values({ userId, date: date.data, mode: mode.data })
    .onConflictDoUpdate({
      target: [dayPlans.userId, dayPlans.date],
      set: { mode: mode.data, updatedAt: new Date() },
    });
  refresh();
  return { success: 'Day mode saved.' };
}

export async function createBlockAction(
  _: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const oneOff = checked(form, 'oneOff');
  const startDate = nullable(form, 'startDate');
  if (oneOff && !z.iso.date().safeParse(startDate).success)
    return fail('Choose a valid one-off date.');
  const mask = oneOff
    ? Array.from({ length: 7 }, (_, index) => (index === weekdayIndex(startDate) ? '1' : '0')).join(
        '',
      )
    : weekdays(form);
  const parsed = BlockSchema.safeParse({
    title: nullable(form, 'title'),
    category: nullable(form, 'category'),
    localStartTime: nullable(form, 'localStartTime'),
    localEndTime: nullable(form, 'localEndTime'),
    weekdayMask: mask,
    startDate,
    endDate: oneOff ? startDate : nullable(form, 'endDate'),
    isFixed: checked(form, 'isFixed'),
    taskId: nullable(form, 'taskId'),
    goalId: nullable(form, 'goalId'),
    projectId: nullable(form, 'projectId'),
    allowOverlap: checked(form, 'allowOverlap'),
  });
  if (!parsed.success) return invalid(parsed.error);
  const result = await db.transaction(async (db) => {
    await db.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${`habitflow-schedule:${userId}`}, 0))`,
    );
    if (
      parsed.data.taskId &&
      !(
        await db
          .select({ id: tasks.id })
          .from(tasks)
          .where(and(eq(tasks.id, parsed.data.taskId), eq(tasks.userId, userId)))
          .limit(1)
      )[0]
    )
      return fail('Task not found.');
    if (
      parsed.data.goalId &&
      !(
        await db
          .select({ id: goals.id })
          .from(goals)
          .where(and(eq(goals.id, parsed.data.goalId), eq(goals.userId, userId)))
          .limit(1)
      )[0]
    )
      return fail('Goal not found.');
    if (
      parsed.data.projectId &&
      !(
        await db
          .select({ id: projects.id })
          .from(projects)
          .where(and(eq(projects.id, parsed.data.projectId), eq(projects.userId, userId)))
          .limit(1)
      )[0]
    )
      return fail('Project not found.');
    const { allowOverlap, ...values } = parsed.data;
    const [rules, revisions] = await Promise.all([
      db.select().from(timeBlocks).where(eq(timeBlocks.userId, userId)),
      db.select().from(timeBlockRevisions).where(eq(timeBlockRevisions.userId, userId)),
    ]);
    const allExceptions = await db
      .select()
      .from(timeBlockExceptions)
      .where(eq(timeBlockExceptions.userId, userId));
    const candidate = { ...values, id: '__new__', status: 'active' };
    const conflict = futureBoundaryDates(values.startDate, rules, revisions, allExceptions).flatMap(
      (date) =>
        occursOn(candidate, date)
          ? expandBlocks(rules, allExceptions, date, date, revisions).filter(
              (item) => item.occurrenceStatus !== 'skipped' && overlaps(item, candidate),
            )
          : [],
    )[0];
    if (conflict && (conflict.isFixed || values.isFixed || !allowOverlap))
      return fail(
        `Overlaps ${conflict.title}. Choose another time${conflict.isFixed ? '.' : ' or confirm a flexible overlap.'}`,
      );
    const [created] = await db
      .insert(timeBlocks)
      .values({ userId, ...values })
      .returning({ id: timeBlocks.id });
    await db.insert(timeBlockRevisions).values({
      userId,
      blockId: created.id,
      effectiveDate: values.startDate,
      title: values.title,
      category: values.category,
      localStartTime: values.localStartTime,
      localEndTime: values.localEndTime,
      weekdayMask: values.weekdayMask,
      status: 'active',
      endDate: values.endDate,
      isFixed: values.isFixed,
      taskId: values.taskId,
      goalId: values.goalId,
      projectId: values.projectId,
    });
    return { success: 'Time block added.' };
  });
  if (result.success) refresh();
  return result;
}

export async function updateBlockStatusAction(
  _: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const parsed = z
    .object({
      id: z.uuid(),
      status: z.enum(['active', 'paused', 'archived']),
      effectiveDate: z.iso.date().optional(),
    })
    .safeParse({
      id: form.get('id'),
      status: form.get('status'),
      effectiveDate: form.get('effectiveDate') || undefined,
    });
  if (!parsed.success) return invalid(parsed.error);
  const settings = await getUserSettings(userId);
  const today = toDateString(getTodayInTimezone(settings.timezone));
  const effectiveDate = parsed.data.effectiveDate ?? today;
  if (effectiveDate < today) return fail('Changes must begin today or later.');
  const result = await db.transaction(async (db) => {
    await db.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${`habitflow-schedule:${userId}`}, 0))`,
    );
    const [block] = await db
      .select()
      .from(timeBlocks)
      .where(and(eq(timeBlocks.userId, userId), eq(timeBlocks.id, parsed.data.id)))
      .limit(1);
    if (!block) return fail('Time block not found.');
    const revisions = await db
      .select()
      .from(timeBlockRevisions)
      .where(and(eq(timeBlockRevisions.userId, userId), eq(timeBlockRevisions.blockId, block.id)));
    const current = ruleOn(block, revisions, effectiveDate);
    if (current.isFixed && !checked(form, 'confirmFixed'))
      return fail('Confirm this fixed commitment change before saving.');
    if (effectiveDate === today && occursOn(current, today, true)) {
      const start = scheduledInstant(today, current.localStartTime, settings.timezone);
      if (!start || start <= serverNow())
        return fail('Today’s session has begun. Choose a later effective date.');
    }
    await db
      .insert(timeBlockRevisions)
      .values({
        userId,
        blockId: block.id,
        effectiveDate,
        title: current.title,
        category: current.category,
        localStartTime: current.localStartTime,
        localEndTime: current.localEndTime,
        weekdayMask: current.weekdayMask,
        status: parsed.data.status,
        endDate: current.endDate,
        isFixed: current.isFixed,
        taskId: current.taskId,
        goalId: current.goalId,
        projectId: current.projectId,
      })
      .onConflictDoUpdate({
        target: [timeBlockRevisions.blockId, timeBlockRevisions.effectiveDate],
        set: { status: parsed.data.status },
      });
    await db
      .update(timeBlocks)
      .set({ status: parsed.data.status, updatedAt: new Date() })
      .where(and(eq(timeBlocks.userId, userId), eq(timeBlocks.id, block.id)));
    return { success: 'Time block updated.' };
  });
  if (result.success) refresh();
  return result;
}

export async function editBlockAction(
  _: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const id = z.uuid().safeParse(form.get('id'));
  if (!id.success) return fail('Time block not found.');
  const block = (
    await db
      .select()
      .from(timeBlocks)
      .where(and(eq(timeBlocks.userId, userId), eq(timeBlocks.id, id.data)))
      .limit(1)
  )[0];
  if (!block) return fail('Time block not found.');
  const parsed = BlockSchema.safeParse({
    title: nullable(form, 'title'),
    category: nullable(form, 'category'),
    localStartTime: nullable(form, 'localStartTime'),
    localEndTime: nullable(form, 'localEndTime'),
    weekdayMask: weekdays(form),
    startDate: block.startDate,
    endDate: nullable(form, 'endDate'),
    isFixed: checked(form, 'isFixed'),
    taskId: nullable(form, 'taskId'),
    goalId: nullable(form, 'goalId'),
    projectId: nullable(form, 'projectId'),
    allowOverlap: checked(form, 'allowOverlap'),
  });
  if (!parsed.success) return invalid(parsed.error);
  const { allowOverlap, startDate: _startDate, ...values } = parsed.data;
  void _startDate;
  const settings = await getUserSettings(userId);
  const today = toDateString(getTodayInTimezone(settings.timezone));
  const date = z.iso.date().safeParse(form.get('effectiveDate') || today);
  if (!date.success) return fail('Choose a valid effective date.');
  const effectiveDate = date.data;
  if (effectiveDate < today) return fail('Changes must begin today or later.');
  if (values.endDate && values.endDate < effectiveDate)
    return fail('End date must be on or after the effective date.');
  const result = await db.transaction(async (db) => {
    await db.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${`habitflow-schedule:${userId}`}, 0))`,
    );
    const [block] = await db
      .select()
      .from(timeBlocks)
      .where(and(eq(timeBlocks.userId, userId), eq(timeBlocks.id, id.data)))
      .limit(1);
    if (!block) return fail('Time block not found.');
    const rules = await db.select().from(timeBlocks).where(eq(timeBlocks.userId, userId));
    const revisions = await db
      .select()
      .from(timeBlockRevisions)
      .where(eq(timeBlockRevisions.userId, userId));
    const exceptions = await db
      .select()
      .from(timeBlockExceptions)
      .where(eq(timeBlockExceptions.userId, userId));
    const current = ruleOn(block, revisions, effectiveDate);
    if (effectiveDate === today && occursOn(current, today, true)) {
      const start = scheduledInstant(today, current.localStartTime, settings.timezone);
      if (!start || start <= serverNow())
        return fail('Today’s session has begun. Choose a later effective date.');
    }
    const proposed = { ...current, ...values };
    if ((current.isFixed || proposed.isFixed) && !checked(form, 'confirmFixed'))
      return fail('Confirm this fixed commitment change before saving.');
    if (
      values.taskId &&
      !(
        await db
          .select({ id: tasks.id })
          .from(tasks)
          .where(and(eq(tasks.userId, userId), eq(tasks.id, values.taskId)))
          .limit(1)
      )[0]
    )
      return fail('Task not found.');
    if (
      values.goalId &&
      !(
        await db
          .select({ id: goals.id })
          .from(goals)
          .where(and(eq(goals.userId, userId), eq(goals.id, values.goalId)))
          .limit(1)
      )[0]
    )
      return fail('Goal not found.');
    if (
      values.projectId &&
      !(
        await db
          .select({ id: projects.id })
          .from(projects)
          .where(and(eq(projects.userId, userId), eq(projects.id, values.projectId)))
          .limit(1)
      )[0]
    )
      return fail('Project not found.');
    const proposedRevisions = [
      ...revisions.filter(
        (item) => !(item.blockId === id.data && item.effectiveDate === effectiveDate),
      ),
      {
        blockId: id.data,
        effectiveDate,
        title: proposed.title,
        category: proposed.category,
        localStartTime: proposed.localStartTime,
        localEndTime: proposed.localEndTime,
        weekdayMask: proposed.weekdayMask,
        status: proposed.status,
        endDate: proposed.endDate,
        isFixed: proposed.isFixed,
        taskId: proposed.taskId,
        goalId: proposed.goalId,
        projectId: proposed.projectId,
      },
    ];
    const conflict = futureBoundaryDates(effectiveDate, rules, revisions, exceptions).flatMap(
      (date) => {
        const changed = expandBlocks(rules, exceptions, date, date, proposedRevisions);
        const candidates = changed.filter(
          (item) =>
            item.id === id.data &&
            item.originalDate >= effectiveDate &&
            item.occurrenceStatus !== 'skipped',
        );
        const others = expandBlocks(rules, exceptions, date, date, revisions).filter(
          (item) =>
            item.occurrenceStatus !== 'skipped' &&
            !candidates.some((own) => sameOccurrence(own, item)),
        );
        return [...others, ...candidates].filter((item) =>
          candidates.some((own) => !sameOccurrence(own, item) && overlaps(own, item)),
        );
      },
    )[0];
    if (conflict && (conflict.isFixed || proposed.isFixed || !allowOverlap))
      return fail(
        `Overlaps ${conflict.title}. Choose another time${conflict.isFixed ? '.' : ' or confirm a flexible overlap.'}`,
      );
    if (form.get('preview') === 'yes')
      return {
        success: conflict
          ? `Flexible overlap with ${conflict.title} is permitted. No change was saved.`
          : 'No conflicts detected. No change was saved.',
      };
    await db
      .insert(timeBlockRevisions)
      .values({
        userId,
        blockId: id.data,
        effectiveDate,
        title: proposed.title,
        category: proposed.category,
        localStartTime: proposed.localStartTime,
        localEndTime: proposed.localEndTime,
        weekdayMask: proposed.weekdayMask,
        status: proposed.status,
        endDate: proposed.endDate,
        isFixed: proposed.isFixed,
        taskId: proposed.taskId,
        goalId: proposed.goalId,
        projectId: proposed.projectId,
      })
      .onConflictDoUpdate({
        target: [timeBlockRevisions.blockId, timeBlockRevisions.effectiveDate],
        set: {
          title: proposed.title,
          category: proposed.category,
          localStartTime: proposed.localStartTime,
          localEndTime: proposed.localEndTime,
          weekdayMask: proposed.weekdayMask,
          endDate: proposed.endDate,
          isFixed: proposed.isFixed,
          taskId: proposed.taskId,
          goalId: proposed.goalId,
          projectId: proposed.projectId,
        },
      });
    await db
      .update(timeBlocks)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(timeBlocks.userId, userId), eq(timeBlocks.id, id.data)));
    return { success: 'Time block edited.' };
  });
  if (result.success && form.get('preview') !== 'yes') refresh();
  return result;
}

export async function previewBlockEditAction(
  state: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  form.set('preview', 'yes');
  return editBlockAction(state, form);
}

export async function updateOccurrenceAction(
  _: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const parsed = ExceptionSchema.safeParse({
    blockId: form.get('blockId'),
    occurrenceDate: form.get('occurrenceDate'),
    status: form.get('status'),
    overrideDate: nullable(form, 'overrideDate'),
    overrideStartTime: nullable(form, 'overrideStartTime'),
    overrideEndTime: nullable(form, 'overrideEndTime'),
    reason: nullable(form, 'reason'),
    allowOverlap: checked(form, 'allowOverlap'),
  });
  if (!parsed.success) return invalid(parsed.error);
  const completeLinkedTask = form.get('completeLinkedTask') === 'yes';
  if (completeLinkedTask && parsed.data.status !== 'completed')
    return fail('A linked task can only be completed with its session.');
  const settings = await getUserSettings(userId);
  const result = await db.transaction(async (db) => {
    await db.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${`habitflow-schedule:${userId}`}, 0))`,
    );
    const block = (
      await db
        .select()
        .from(timeBlocks)
        .where(and(eq(timeBlocks.userId, userId), eq(timeBlocks.id, parsed.data.blockId)))
        .limit(1)
    )[0];
    if (!block) return fail('Scheduled occurrence not found.');
    const revisions = await db
      .select()
      .from(timeBlockRevisions)
      .where(and(eq(timeBlockRevisions.userId, userId), eq(timeBlockRevisions.blockId, block.id)));
    const previous = (
      await db
        .select()
        .from(timeBlockExceptions)
        .where(
          and(
            eq(timeBlockExceptions.userId, userId),
            eq(timeBlockExceptions.blockId, block.id),
            eq(timeBlockExceptions.occurrenceDate, parsed.data.occurrenceDate),
          ),
        )
        .limit(1)
    )[0];
    const rule = ruleOn(block, revisions, parsed.data.occurrenceDate);
    const linkedTask =
      completeLinkedTask && rule.taskId
        ? (
            await db
              .select()
              .from(tasks)
              .where(and(eq(tasks.userId, userId), eq(tasks.id, rule.taskId)))
              .limit(1)
          )[0]
        : null;
    if (completeLinkedTask && !linkedTask)
      return fail('The linked task is no longer available. Complete this session separately.');
    if (linkedTask?.status === 'cancelled')
      return fail('Restore the cancelled task before completing it.');
    if (
      (!occursOn(rule, parsed.data.occurrenceDate, true) && !previous) ||
      (rule.status !== 'active' &&
        parsed.data.occurrenceDate >= toDateString(getTodayInTimezone(settings.timezone)))
    )
      return fail('Scheduled occurrence not found.');
    if (rule.isFixed && ['skipped', 'rescheduled'].includes(parsed.data.status))
      return fail(
        'Fixed commitments cannot be skipped or moved here. Edit the series intentionally.',
      );
    if (parsed.data.status === 'rescheduled' && !parsed.data.overrideDate)
      return fail('Choose a new date.');
    if (
      parsed.data.status === 'planned' &&
      !['skipped', 'excused', 'rescheduled'].includes(previous?.status ?? '')
    )
      return fail('Only a skipped, excused, or moved session can be restored.');
    if (
      ['skipped', 'excused'].includes(previous?.status ?? '') &&
      ['started', 'completed'].includes(parsed.data.status)
    )
      return fail('Restore this session before recording progress.');
    if (previous?.status === 'completed' && parsed.data.status === 'skipped')
      return fail('A completed session cannot be skipped.');
    const retained =
      ['started', 'completed'].includes(parsed.data.status) && previous
        ? {
            ...parsed.data,
            overrideDate: previous.overrideDate,
            overrideStartTime: previous.overrideStartTime,
            overrideEndTime: previous.overrideEndTime,
          }
        : parsed.data;
    const startTime = retained.overrideStartTime ?? rule.localStartTime;
    const endTime = retained.overrideEndTime ?? rule.localEndTime;
    if (endTime <= startTime) return fail('End time must be after start time.');
    if (parsed.data.status === 'started' || parsed.data.status === 'completed') {
      const error = statusTimeError(
        parsed.data.status,
        retained.overrideDate ?? parsed.data.occurrenceDate,
        startTime,
        endTime,
        settings.timezone,
        serverNow(),
      );
      if (error) return fail(error);
    }
    if (parsed.data.status === 'rescheduled' || parsed.data.status === 'planned') {
      const targetDate = retained.overrideDate ?? retained.occurrenceDate;
      const rules = await db.select().from(timeBlocks).where(eq(timeBlocks.userId, userId));
      const exceptions = await db
        .select()
        .from(timeBlockExceptions)
        .where(eq(timeBlockExceptions.userId, userId));
      const allRevisions = await db
        .select()
        .from(timeBlockRevisions)
        .where(eq(timeBlockRevisions.userId, userId));
      const conflict = expandBlocks(rules, exceptions, targetDate, targetDate, allRevisions).find(
        (item) =>
          !['skipped', 'excused'].includes(item.occurrenceStatus) &&
          !sameOccurrence(item, { id: block.id, originalDate: parsed.data.occurrenceDate }) &&
          overlaps(item, { localStartTime: startTime, localEndTime: endTime }),
      );
      if (conflict && (conflict.isFixed || !parsed.data.allowOverlap))
        return fail(
          `Overlaps ${conflict.title}. Choose another time${conflict.isFixed ? '.' : ' or confirm a flexible overlap.'}`,
        );
    }
    const { allowOverlap: _allowOverlap, ...values } = retained;
    void _allowOverlap;
    if (parsed.data.status === 'planned' || parsed.data.status === 'skipped') {
      values.overrideDate = null;
      values.overrideStartTime = null;
      values.overrideEndTime = null;
    }
    if (form.get('preview') === 'yes')
      return { success: 'No conflicts detected. No change was saved.' };
    await db
      .insert(timeBlockExceptions)
      .values({ userId, ...values })
      .onConflictDoUpdate({
        target: [timeBlockExceptions.blockId, timeBlockExceptions.occurrenceDate],
        set: { ...values, timeOffId: null, updatedAt: new Date() },
      });
    if (linkedTask && linkedTask.status !== 'done')
      await db
        .update(tasks)
        .set({
          status: 'done',
          completedAt: linkedTask.completedAt ?? new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(tasks.userId, userId), eq(tasks.id, linkedTask.id)));
    return { success: linkedTask ? 'Session and linked task completed.' : 'Occurrence updated.' };
  });
  if (result.success && form.get('preview') !== 'yes') refresh();
  return result;
}

export async function previewOccurrenceAction(
  state: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  form.set('preview', 'yes');
  return updateOccurrenceAction(state, form);
}

export async function saveSubjectAction(
  _: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const parsed = SubjectSchema.safeParse({
    slot: form.get('slot'),
    name: nullable(form, 'name'),
    targetGrade: nullable(form, 'targetGrade'),
    actualGrade: nullable(form, 'actualGrade'),
  });
  if (!parsed.success) return invalid(parsed.error);
  await db
    .insert(subjects)
    .values({ userId, ...parsed.data })
    .onConflictDoUpdate({
      target: [subjects.userId, subjects.slot],
      set: { ...parsed.data, updatedAt: new Date() },
    });
  refresh();
  revalidatePath('/goals/evidence');
  return { success: 'Subject saved.' };
}

export async function addAssessmentAction(
  _: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const parsed = z
    .object({
      subjectId: z.uuid(),
      title: z.string().trim().min(1).max(160),
      dueDate: z.union([z.iso.date(), z.literal('')]).transform((value) => value || null),
    })
    .safeParse({
      subjectId: form.get('subjectId'),
      title: form.get('title'),
      dueDate: nullable(form, 'dueDate'),
    });
  if (!parsed.success) return invalid(parsed.error);
  if (
    !(
      await db
        .select({ id: subjects.id })
        .from(subjects)
        .where(and(eq(subjects.id, parsed.data.subjectId), eq(subjects.userId, userId)))
        .limit(1)
    )[0]
  )
    return fail('Subject not found.');
  await db.insert(subjectAssessments).values({ userId, ...parsed.data });
  refresh();
  return { success: 'Assessment added.' };
}

export async function updateAssessmentAction(
  _: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const parsed = z
    .object({ id: z.uuid(), status: z.enum(['todo', 'done']), actualGrade: z.string().max(20) })
    .safeParse({
      id: form.get('id'),
      status: form.get('status'),
      actualGrade: nullable(form, 'actualGrade'),
    });
  if (!parsed.success) return invalid(parsed.error);
  const changed = await db
    .update(subjectAssessments)
    .set({
      status: parsed.data.status,
      actualGrade: parsed.data.actualGrade || null,
      updatedAt: new Date(),
    })
    .where(and(eq(subjectAssessments.userId, userId), eq(subjectAssessments.id, parsed.data.id)))
    .returning({ id: subjectAssessments.id });
  if (!changed.length) return fail('Assessment not found.');
  refresh();
  return { success: 'Assessment updated.' };
}

export async function addMetricAction(
  _: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const parsed = MetricSchema.safeParse({
    date: form.get('date'),
    type: nullable(form, 'type'),
    value: form.get('value'),
    unit: nullable(form, 'unit'),
    note: nullable(form, 'note'),
  });
  if (!parsed.success) return invalid(parsed.error);
  await db.insert(metricEntries).values({ userId, ...parsed.data });
  refresh();
  return { success: 'Measurement recorded.' };
}

export async function saveReviewAction(
  _: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const weekStart = z.iso.date().safeParse(form.get('weekStart'));
  if (!weekStart.success) return fail('Choose a valid week.');
  const note = nullable(form, 'nextWins').trim();
  if (note.length > 2000) return fail('Keep your note under 2,000 characters.');
  const existing = await getReview(userId, weekStart.data);
  let answers: Record<string, string> = {};
  if (existing?.answers) {
    try {
      answers = JSON.parse(existing.answers) as Record<string, string>;
    } catch {
      answers = {};
    }
  }
  answers.nextWins = note;
  await db
    .insert(weeklyReviews)
    .values({ userId, weekStart: weekStart.data, answers: JSON.stringify(answers) })
    .onConflictDoUpdate({
      target: [weeklyReviews.userId, weeklyReviews.weekStart],
      set: { answers: JSON.stringify(answers), updatedAt: new Date() },
    });
  refresh();
  return { success: 'Note saved.' };
}
