'use server';

import { and, desc, eq, gte, lt } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import {
  applicationStageHistory,
  englishPractices,
  grammarMistakes,
  internshipApplications,
  interviewPractices,
  metricEntries,
  milestoneCriteria,
  milestoneReviewHistory,
  milestoneReviews,
  subjectTopics,
  subjects,
  tasks,
  topicPractices,
} from '@/lib/db/schema';
import { getUserSettings } from '@/lib/dal/user-settings';
import { fromZonedTime, getTodayInTimezone, serverNow, toDateString } from '@/lib/utils/date';
import { addCalendarDays } from '@/lib/planning/time-blocks';
import type { LifeActionState } from './life-actions';
import { canAcceptMilestone, validScoredAttempt } from '@/lib/evidence/summary';

const fail = (error: string): LifeActionState => ({ error });
const bad = (error: z.ZodError): LifeActionState =>
  fail(error.issues[0]?.message ?? 'Check the fields.');
const value = (form: FormData, key: string) => String(form.get(key) ?? '').trim();
const optionalDate = z.union([z.iso.date(), z.literal('')]).transform((item) => item || null);
const optionalId = z.union([z.uuid(), z.literal('')]).transform((item) => item || null);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((item) => item || null);
const optionalUrl = z
  .union([z.url({ protocol: /^https?$/ }), z.literal('')])
  .transform((item) => item || null);
const optionalRating = z
  .union([z.literal(''), z.coerce.number().int().min(1).max(5)])
  .transform((item) => (item === '' ? null : item));
const optionalMinutes = z
  .union([z.literal(''), z.coerce.number().int().min(1).max(1440)])
  .transform((item) => (item === '' ? null : item));
const title = z.string().trim().min(1).max(160);
const refresh = () => {
  for (const path of ['/dashboard', '/goals', '/goals/evidence', '/review', '/today'])
    revalidatePath(path);
};
async function todayFor(userId: string) {
  const settings = await getUserSettings(userId);
  return toDateString(getTodayInTimezone(settings.timezone));
}

async function sameDayEditWindowFor(userId: string) {
  const settings = await getUserSettings(userId);
  const today = toDateString(getTodayInTimezone(settings.timezone));
  return {
    today,
    start: fromZonedTime(`${today}T00:00:00`, settings.timezone),
    end: fromZonedTime(`${addCalendarDays(today, 1)}T00:00:00`, settings.timezone),
  };
}

export async function saveTopicAction(
  _: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const parsed = z
    .object({
      id: optionalId,
      subjectId: z.uuid(),
      title,
      priority: z.coerce.number().int().min(1).max(3),
      status: z.enum([
        'not_started',
        'learning',
        'practising',
        'demonstrated_mastery',
        'needs_revision',
      ]),
      nextRevisionDate: optionalDate,
    })
    .safeParse({
      id: value(form, 'id'),
      subjectId: form.get('subjectId'),
      title: form.get('title'),
      priority: form.get('priority'),
      status: form.get('status'),
      nextRevisionDate: value(form, 'nextRevisionDate'),
    });
  if (!parsed.success) return bad(parsed.error);
  const input = parsed.data;
  if (
    !(
      await db
        .select({ id: subjects.id })
        .from(subjects)
        .where(and(eq(subjects.userId, userId), eq(subjects.id, input.subjectId)))
        .limit(1)
    )[0]
  )
    return fail('Subject not found.');
  if (input.id) {
    const changed = await db
      .update(subjectTopics)
      .set({
        subjectId: input.subjectId,
        title: input.title,
        priority: input.priority,
        status: input.status,
        nextRevisionDate: input.nextRevisionDate,
        updatedAt: new Date(),
      })
      .where(and(eq(subjectTopics.userId, userId), eq(subjectTopics.id, input.id)))
      .returning({ id: subjectTopics.id });
    if (!changed.length) return fail('Topic not found.');
  } else
    await db.insert(subjectTopics).values({
      userId,
      subjectId: input.subjectId,
      title: input.title,
      priority: input.priority,
      status: input.status,
      nextRevisionDate: input.nextRevisionDate,
    });
  refresh();
  return { success: 'Topic saved. Practice evidence remains separate from grades.' };
}

export async function addTopicPracticeAction(
  _: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const score = z.union([z.literal(''), z.coerce.number().int().min(0).max(10000)]);
  const parsed = z
    .object({
      topicId: z.uuid(),
      date: z.iso.date(),
      type: z.enum(['active_recall', 'quiz', 'past_paper', 'problem_solving', 'explanation']),
      correct: score,
      total: score,
      confidence: optionalRating,
      durationMinutes: optionalMinutes,
      note: optionalText(1000),
    })
    .safeParse({
      topicId: form.get('topicId'),
      date: form.get('date'),
      type: form.get('type'),
      correct: value(form, 'correct'),
      total: value(form, 'total'),
      confidence: value(form, 'confidence'),
      durationMinutes: value(form, 'durationMinutes'),
      note: value(form, 'note'),
    });
  if (!parsed.success) return bad(parsed.error);
  const input = parsed.data;
  if (
    !validScoredAttempt(
      input.correct === '' ? null : input.correct,
      input.total === '' ? null : input.total,
    )
  )
    return fail('Enter both score fields with 0 ≤ correct ≤ total and total above zero.');
  if (input.date > (await todayFor(userId))) return fail('Practice date cannot be in the future.');
  if (
    !(
      await db
        .select({ id: subjectTopics.id })
        .from(subjectTopics)
        .where(and(eq(subjectTopics.userId, userId), eq(subjectTopics.id, input.topicId)))
        .limit(1)
    )[0]
  )
    return fail('Topic not found.');
  await db.insert(topicPractices).values({
    userId,
    topicId: input.topicId,
    date: input.date,
    type: input.type,
    correct: input.correct === '' ? null : input.correct,
    total: input.total === '' ? null : input.total,
    confidence: input.confidence,
    durationMinutes: input.durationMinutes,
    note: input.note,
  });
  refresh();
  return { success: 'Practice evidence recorded.' };
}

export async function saveCriterionAction(
  _: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const parsed = z
    .object({
      id: optionalId,
      taskId: z.uuid(),
      title: z.string().trim().min(1).max(200),
      met: z.boolean(),
    })
    .safeParse({
      id: value(form, 'id'),
      taskId: form.get('taskId'),
      title: form.get('title'),
      met: form.get('met') === 'on',
    });
  if (!parsed.success) return bad(parsed.error);
  const input = parsed.data;
  const result = await db.transaction(async (tx) => {
    const milestone = (
      await tx
        .select({ id: tasks.id })
        .from(tasks)
        .where(
          and(eq(tasks.userId, userId), eq(tasks.id, input.taskId), eq(tasks.isMilestone, true)),
        )
        .for('update')
        .limit(1)
    )[0];
    if (!milestone) return fail('Milestone not found.');
    if (input.id) {
      const changed = await tx
        .update(milestoneCriteria)
        .set({ title: input.title, met: input.met, updatedAt: new Date() })
        .where(
          and(
            eq(milestoneCriteria.userId, userId),
            eq(milestoneCriteria.id, input.id),
            eq(milestoneCriteria.taskId, input.taskId),
          ),
        )
        .returning({ id: milestoneCriteria.id });
      if (!changed.length) return fail('Criterion not found.');
    } else
      await tx
        .insert(milestoneCriteria)
        .values({ userId, taskId: input.taskId, title: input.title, met: input.met });
    return { success: 'Quality criterion saved.' };
  });
  if (result.success) refresh();
  return result;
}

export async function saveMilestoneReviewAction(
  _: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const parsed = z
    .object({
      taskId: z.uuid(),
      state: z.enum(['not_reviewed', 'needs_improvements', 'meets_criteria']),
      reviewer: z.string().trim().min(1).max(80),
      reviewedOn: optionalDate,
      repositoryUrl: optionalUrl,
      testReference: optionalText(500),
      documentationUrl: optionalUrl,
      note: optionalText(2000),
    })
    .safeParse({
      taskId: form.get('taskId'),
      state: form.get('state'),
      reviewer: form.get('reviewer'),
      reviewedOn: value(form, 'reviewedOn'),
      repositoryUrl: value(form, 'repositoryUrl'),
      testReference: value(form, 'testReference'),
      documentationUrl: value(form, 'documentationUrl'),
      note: value(form, 'note'),
    });
  if (!parsed.success) return bad(parsed.error);
  const input = parsed.data;
  const result = await db.transaction(async (tx) => {
    const task = (
      await tx
        .select()
        .from(tasks)
        .where(
          and(eq(tasks.userId, userId), eq(tasks.id, input.taskId), eq(tasks.isMilestone, true)),
        )
        .for('update')
        .limit(1)
    )[0];
    if (!task) return fail('Milestone not found.');
    const criteria = await tx
      .select()
      .from(milestoneCriteria)
      .where(and(eq(milestoneCriteria.userId, userId), eq(milestoneCriteria.taskId, input.taskId)));
    if (input.state === 'meets_criteria' && !canAcceptMilestone(criteria))
      return fail('Define and meet each criterion before marking acceptance.');
    if (input.state === 'meets_criteria' && !input.reviewedOn)
      return fail('Record the review date.');
    await tx
      .insert(milestoneReviews)
      .values({ userId, ...input })
      .onConflictDoUpdate({
        target: [milestoneReviews.userId, milestoneReviews.taskId],
        set: { ...input, updatedAt: new Date() },
      });
    await tx.insert(milestoneReviewHistory).values({
      userId,
      ...input,
      criteriaSnapshot: JSON.stringify(
        criteria.map((item) => ({ title: item.title, met: item.met })),
      ),
    });
    return { success: 'Milestone review saved separately from task completion.' };
  });
  if (result.success) refresh();
  return result;
}

export async function addInterviewPracticeAction(
  _: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const parsed = z
    .object({
      topic: z.string().trim().min(1).max(160),
      date: z.iso.date(),
      roleTrack: z.enum(['SE', 'AI', 'DevOps', 'QA']),
      type: z.enum(['mock', 'technical_question', 'coding', 'explanation']),
      durationMinutes: z.coerce.number().int().min(1).max(1440),
    })
    .safeParse({
      topic: value(form, 'topic'),
      date: form.get('date'),
      roleTrack: form.get('roleTrack'),
      type: form.get('type'),
      durationMinutes: value(form, 'durationMinutes'),
    });
  if (!parsed.success) return bad(parsed.error);
  const { topic, ...input } = parsed.data;
  if (input.date > (await todayFor(userId))) return fail('Practice date cannot be in the future.');
  await db
    .insert(interviewPractices)
    .values({ userId, topicText: topic, ...input, createdAt: serverNow() });
  refresh();
  return { success: 'Interview practice recorded.' };
}

export async function updateInterviewPracticeAction(
  _: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const parsed = z
    .object({
      id: z.uuid(),
      date: z.iso.date(),
      topic: z.string().trim().min(1).max(160),
      roleTrack: z.enum(['SE', 'AI', 'DevOps', 'QA']),
      type: z.enum(['mock', 'technical_question', 'coding', 'explanation']),
      durationMinutes: optionalMinutes,
    })
    .safeParse({
      id: form.get('id'),
      date: form.get('date'),
      topic: value(form, 'topic'),
      roleTrack: form.get('roleTrack'),
      type: form.get('type'),
      durationMinutes: value(form, 'durationMinutes'),
    });
  if (!parsed.success) return bad(parsed.error);
  const { id, topic, ...input } = parsed.data;
  const { today, start, end } = await sameDayEditWindowFor(userId);
  if (input.date > today) return fail('Practice date cannot be in the future.');
  const [updated] = await db
    .update(interviewPractices)
    .set({ topicText: topic, ...input })
    .where(
      and(
        eq(interviewPractices.id, id),
        eq(interviewPractices.userId, userId),
        gte(interviewPractices.createdAt, start),
        lt(interviewPractices.createdAt, end),
      ),
    )
    .returning({ id: interviewPractices.id });
  if (!updated) return fail('This practice can only be edited on the day it was added.');
  refresh();
  return { success: 'Interview practice updated.' };
}

export async function deleteInterviewPracticeAction(
  _: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const id = z.uuid().safeParse(form.get('id'));
  if (!id.success) return bad(id.error);
  const { start, end } = await sameDayEditWindowFor(userId);
  const [deleted] = await db
    .delete(interviewPractices)
    .where(
      and(
        eq(interviewPractices.id, id.data),
        eq(interviewPractices.userId, userId),
        gte(interviewPractices.createdAt, start),
        lt(interviewPractices.createdAt, end),
      ),
    )
    .returning({ id: interviewPractices.id });
  if (!deleted) return fail('This practice can only be deleted on the day it was added.');
  refresh();
  return { success: 'Interview practice deleted.' };
}

export async function createInterviewFollowUpAction(
  _: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const id = z.uuid().safeParse(form.get('id'));
  if (!id.success) return bad(id.error);
  const result = await db.transaction(async (tx) => {
    const practice = (
      await tx
        .select()
        .from(interviewPractices)
        .where(and(eq(interviewPractices.userId, userId), eq(interviewPractices.id, id.data)))
        .for('update')
        .limit(1)
    )[0];
    if (!practice) return fail('Practice not found.');
    if (!practice.nextAction) return fail('Add a next action to this practice first.');
    if (practice.followUpTaskId) return fail('Follow-up task already exists.');
    const [task] = await tx
      .insert(tasks)
      .values({
        userId,
        title: practice.nextAction.slice(0, 160),
        area: 'Career',
        details: practice.weaknesses,
        status: 'todo',
      })
      .returning({ id: tasks.id });
    await tx
      .update(interviewPractices)
      .set({ followUpTaskId: task.id })
      .where(and(eq(interviewPractices.userId, userId), eq(interviewPractices.id, id.data)));
    return { success: 'Ordinary follow-up task created.' };
  });
  if (result.success) refresh();
  return result;
}

export async function addEnglishPracticeAction(
  _: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const parsed = z
    .object({
      date: z.iso.date(),
      type: z.enum([
        'free_speaking',
        'technical_explanation',
        'mock_interview',
        'conversation',
        'grammar',
        'pronunciation',
      ]),
      topic: title,
      durationMinutes: z.coerce.number().int().min(1).max(1440),
    })
    .safeParse({
      date: form.get('date'),
      type: form.get('type'),
      topic: form.get('topic'),
      durationMinutes: form.get('durationMinutes'),
    });
  if (!parsed.success) return bad(parsed.error);
  if (parsed.data.date > (await todayFor(userId)))
    return fail('Practice date cannot be in the future.');
  await db.insert(englishPractices).values({ userId, ...parsed.data, createdAt: serverNow() });
  refresh();
  return { success: 'English practice recorded.' };
}

export async function updateEnglishPracticeAction(
  _: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const parsed = z
    .object({
      id: z.uuid(),
      date: z.iso.date(),
      type: z.enum([
        'free_speaking',
        'technical_explanation',
        'mock_interview',
        'conversation',
        'grammar',
        'pronunciation',
      ]),
      topic: title,
      durationMinutes: z.coerce.number().int().min(1).max(1440),
    })
    .safeParse({
      id: form.get('id'),
      date: form.get('date'),
      type: form.get('type'),
      topic: form.get('topic'),
      durationMinutes: form.get('durationMinutes'),
    });
  if (!parsed.success) return bad(parsed.error);
  const { id, ...input } = parsed.data;
  const { today, start, end } = await sameDayEditWindowFor(userId);
  if (input.date > today) return fail('Practice date cannot be in the future.');
  const [updated] = await db
    .update(englishPractices)
    .set(input)
    .where(
      and(
        eq(englishPractices.id, id),
        eq(englishPractices.userId, userId),
        gte(englishPractices.createdAt, start),
        lt(englishPractices.createdAt, end),
      ),
    )
    .returning({ id: englishPractices.id });
  if (!updated) return fail('This practice can only be edited on the day it was added.');
  refresh();
  return { success: 'English practice updated.' };
}

export async function deleteEnglishPracticeAction(
  _: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const id = z.uuid().safeParse(form.get('id'));
  if (!id.success) return bad(id.error);
  const { start, end } = await sameDayEditWindowFor(userId);
  const deleted = await db.transaction(async (tx) => {
    const [eligible] = await tx
      .select({ id: englishPractices.id })
      .from(englishPractices)
      .where(
        and(
          eq(englishPractices.id, id.data),
          eq(englishPractices.userId, userId),
          gte(englishPractices.createdAt, start),
          lt(englishPractices.createdAt, end),
        ),
      )
      .for('update')
      .limit(1);
    if (!eligible) return false;
    await tx
      .update(grammarMistakes)
      .set({ practiceId: null })
      .where(and(eq(grammarMistakes.userId, userId), eq(grammarMistakes.practiceId, id.data)));
    await tx
      .delete(englishPractices)
      .where(and(eq(englishPractices.id, id.data), eq(englishPractices.userId, userId)));
    return true;
  });
  if (!deleted) return fail('This practice can only be deleted on the day it was added.');
  refresh();
  return { success: 'English practice deleted.' };
}
export async function addGrammarMistakeAction(
  _: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const parsed = z
    .object({
      practiceId: optionalId,
      original: z.string().trim().min(1).max(1000),
      corrected: z.string().trim().min(1).max(1000),
      category: z.string().trim().min(1).max(80),
      note: optionalText(1000),
    })
    .safeParse({
      practiceId: value(form, 'practiceId'),
      original: form.get('original'),
      corrected: form.get('corrected'),
      category: form.get('category'),
      note: value(form, 'note'),
    });
  if (!parsed.success) return bad(parsed.error);
  if (
    parsed.data.practiceId &&
    !(
      await db
        .select({ id: englishPractices.id })
        .from(englishPractices)
        .where(
          and(eq(englishPractices.userId, userId), eq(englishPractices.id, parsed.data.practiceId)),
        )
        .limit(1)
    )[0]
  )
    return fail('Practice not found.');
  await db.insert(grammarMistakes).values({ userId, ...parsed.data });
  refresh();
  return { success: 'Correction recorded.' };
}
export async function reviewGrammarMistakeAction(
  _: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const id = z.uuid().safeParse(form.get('id'));
  if (!id.success) return bad(id.error);
  const changed = await db
    .update(grammarMistakes)
    .set({ reviewedAt: new Date() })
    .where(and(eq(grammarMistakes.userId, userId), eq(grammarMistakes.id, id.data)))
    .returning({ id: grammarMistakes.id });
  if (!changed.length) return fail('Correction not found.');
  refresh();
  return { success: 'Correction marked reviewed.' };
}

export async function changeWeightAction(
  _: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const parsed = z
    .object({
      id: z.uuid(),
      operation: z.enum(['edit', 'delete']),
      date: z.iso.date(),
      value: z.coerce.number().finite().min(20).max(500),
      note: optionalText(500),
      confirm: z.boolean(),
    })
    .safeParse({
      id: form.get('id'),
      operation: form.get('operation'),
      date: form.get('date'),
      value: form.get('value'),
      note: value(form, 'note'),
      confirm: form.get('confirm') === 'on',
    });
  if (!parsed.success) return bad(parsed.error);
  const input = parsed.data;
  if (input.operation === 'delete') {
    if (!input.confirm) return fail('Confirm removal of this measurement.');
    const removed = await db
      .delete(metricEntries)
      .where(
        and(
          eq(metricEntries.userId, userId),
          eq(metricEntries.id, input.id),
          eq(metricEntries.type, 'Body weight'),
          eq(metricEntries.unit, 'kg'),
        ),
      )
      .returning({ id: metricEntries.id });
    if (!removed.length) return fail('Weight measurement not found.');
  } else {
    if (input.date > (await todayFor(userId)))
      return fail('Measurement date cannot be in the future.');
    const changed = await db
      .update(metricEntries)
      .set({ date: input.date, value: input.value, note: input.note })
      .where(
        and(
          eq(metricEntries.userId, userId),
          eq(metricEntries.id, input.id),
          eq(metricEntries.type, 'Body weight'),
          eq(metricEntries.unit, 'kg'),
        ),
      )
      .returning({ id: metricEntries.id });
    if (!changed.length) return fail('Weight measurement not found.');
  }
  refresh();
  return {
    success:
      input.operation === 'delete' ? 'Erroneous weight entry removed.' : 'Weight entry corrected.',
  };
}

export async function addWeightAction(
  _: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const parsed = z
    .object({
      date: z.iso.date(),
      value: z.coerce.number().finite().min(20).max(500),
      note: optionalText(500),
    })
    .safeParse({ date: form.get('date'), value: form.get('value'), note: value(form, 'note') });
  if (!parsed.success) return bad(parsed.error);
  if (parsed.data.date > (await todayFor(userId)))
    return fail('Measurement date cannot be in the future.');
  await db.insert(metricEntries).values({
    userId,
    date: parsed.data.date,
    type: 'Body weight',
    unit: 'kg',
    value: parsed.data.value,
    note: parsed.data.note,
  });
  refresh();
  return { success: 'Actual body weight recorded.' };
}

const stages = z.enum([
  'saved',
  'applied',
  'online_assessment',
  'technical_interview',
  'hr_interview',
  'offer',
  'rejected',
  'withdrawn',
  'custom',
]);
export async function saveApplicationAction(
  _: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const parsed = z
    .object({
      id: optionalId,
      company: title,
      roleTitle: title,
      roleTrack: z.enum(['SE', 'AI', 'DevOps', 'QA', 'Other']),
      stage: z.union([stages, z.literal('')]).transform((item) => item || null),
      stageOn: optionalDate,
      url: optionalUrl,
      location: optionalText(160),
      arrangement: z.enum(['', 'onsite', 'hybrid', 'remote']).transform((item) => item || null),
      appliedOn: optionalDate,
      followUpDate: optionalDate,
      contactName: optionalText(160),
      note: optionalText(2000),
    })
    .safeParse({
      id: value(form, 'id'),
      company: form.get('company'),
      roleTitle: form.get('roleTitle'),
      roleTrack: form.get('roleTrack'),
      stage: value(form, 'stage'),
      stageOn: value(form, 'stageOn'),
      url: value(form, 'url'),
      location: value(form, 'location'),
      arrangement: value(form, 'arrangement'),
      appliedOn: value(form, 'appliedOn'),
      followUpDate: value(form, 'followUpDate'),
      contactName: value(form, 'contactName'),
      note: value(form, 'note'),
    });
  if (!parsed.success) return bad(parsed.error);
  const { id, stage: requestedStage, stageOn: requestedStageOn, ...input } = parsed.data;
  const today = await todayFor(userId);
  if (input.appliedOn && input.appliedOn > today)
    return fail('Application date cannot be in the future.');
  if (id) {
    const current = (
      await db
        .select({ stage: internshipApplications.stage })
        .from(internshipApplications)
        .where(and(eq(internshipApplications.userId, userId), eq(internshipApplications.id, id)))
        .limit(1)
    )[0];
    if (!current) return fail('Application not found.');
    if (current.stage === 'saved' && input.appliedOn)
      return fail('Use Update stage to mark this opportunity as applied.');
    if (!['saved', 'withdrawn'].includes(current.stage) && !input.appliedOn)
      return fail('Keep the actual application date for a submitted application.');
    const result = await db.transaction(async (tx) => {
      if (input.appliedOn) {
        const events = await tx
          .select({
            stageOn: applicationStageHistory.stageOn,
            toStage: applicationStageHistory.toStage,
          })
          .from(applicationStageHistory)
          .where(
            and(
              eq(applicationStageHistory.userId, userId),
              eq(applicationStageHistory.applicationId, id),
            ),
          );
        if (
          events.some(
            (event) =>
              event.toStage !== 'applied' &&
              event.toStage !== 'saved' &&
              event.stageOn &&
              event.stageOn < input.appliedOn!,
          )
        ) {
          return fail('Application date cannot be after a recorded later stage date.');
        }
      }
      const changed = await tx
        .update(internshipApplications)
        .set({ ...input, updatedAt: new Date() })
        .where(and(eq(internshipApplications.userId, userId), eq(internshipApplications.id, id)))
        .returning({ id: internshipApplications.id });
      if (!changed.length) return fail('Application not found.');
      if (input.appliedOn) {
        await tx
          .update(applicationStageHistory)
          .set({ stageOn: input.appliedOn })
          .where(
            and(
              eq(applicationStageHistory.userId, userId),
              eq(applicationStageHistory.applicationId, id),
              eq(applicationStageHistory.toStage, 'applied'),
            ),
          );
      }
      return null;
    });
    if (result) return result;
  } else {
    const stage =
      requestedStage === 'saved' && input.appliedOn
        ? 'applied'
        : (requestedStage ?? (input.appliedOn ? 'applied' : 'saved'));
    if (!['saved', 'withdrawn'].includes(stage) && !input.appliedOn)
      return fail('Enter the actual application date for this stage.');
    const stageOn = stage === 'applied' ? input.appliedOn! : (requestedStageOn ?? today);
    if (stageOn > today) return fail('Stage date cannot be in the future.');
    if (input.appliedOn && stageOn < input.appliedOn)
      return fail('Stage date cannot be before the application submission date.');
    await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(internshipApplications)
        .values({ userId, ...input, stage })
        .returning({ id: internshipApplications.id });
      await tx
        .insert(applicationStageHistory)
        .values({ userId, applicationId: created.id, fromStage: null, toStage: stage, stageOn });
    });
  }
  refresh();
  return {
    success: id
      ? 'Application updated.'
      : requestedStage === 'withdrawn'
        ? 'Withdrawn opportunity recorded.'
        : input.appliedOn
          ? 'Submitted application recorded.'
          : 'Opportunity saved; it is not counted as submitted.',
  };
}
export async function changeApplicationStageAction(
  _: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const parsed = z
    .object({ id: z.uuid(), stage: stages, appliedOn: optionalDate, stageOn: optionalDate })
    .safeParse({
      id: form.get('id'),
      stage: form.get('stage'),
      appliedOn: value(form, 'appliedOn'),
      stageOn: value(form, 'stageOn'),
    });
  if (!parsed.success) return bad(parsed.error);
  const input = parsed.data;
  const result = await db.transaction(async (tx) => {
    const current = (
      await tx
        .select()
        .from(internshipApplications)
        .where(
          and(eq(internshipApplications.userId, userId), eq(internshipApplications.id, input.id)),
        )
        .for('update')
        .limit(1)
    )[0];
    if (!current) return fail('Application not found.');
    if (input.stage === 'saved' && current.appliedOn)
      return fail('A submitted application cannot return to Not applied yet.');
    const appliedOn =
      current.appliedOn ?? (['saved', 'withdrawn'].includes(input.stage) ? null : input.appliedOn);
    if (!['saved', 'withdrawn'].includes(input.stage) && !appliedOn)
      return fail('Enter the date you first submitted the application.');
    const today = await todayFor(userId);
    if (!current.appliedOn && appliedOn && appliedOn > today)
      return fail('Application date cannot be in the future.');
    const stageOn = input.stage === 'applied' ? appliedOn! : (input.stageOn ?? today);
    if (stageOn > today) return fail('Stage date cannot be in the future.');
    if (appliedOn && stageOn < appliedOn)
      return fail('Stage date cannot be before the application submission date.');
    if (current.stage === input.stage) {
      const latest = (
        await tx
          .select()
          .from(applicationStageHistory)
          .where(
            and(
              eq(applicationStageHistory.userId, userId),
              eq(applicationStageHistory.applicationId, input.id),
            ),
          )
          .orderBy(desc(applicationStageHistory.changedAt), desc(applicationStageHistory.id))
          .limit(1)
      )[0];
      if (latest?.stageOn === stageOn) return fail('This stage date is already recorded.');
      if (latest && latest.toStage === current.stage) {
        await tx
          .update(applicationStageHistory)
          .set({ stageOn })
          .where(
            and(
              eq(applicationStageHistory.userId, userId),
              eq(applicationStageHistory.id, latest.id),
            ),
          );
      } else {
        await tx.insert(applicationStageHistory).values({
          userId,
          applicationId: input.id,
          fromStage: null,
          toStage: current.stage,
          stageOn,
        });
      }
      await tx
        .update(internshipApplications)
        .set({ updatedAt: new Date() })
        .where(
          and(eq(internshipApplications.userId, userId), eq(internshipApplications.id, input.id)),
        );
      return { success: 'Stage date saved.' };
    }
    await tx
      .update(internshipApplications)
      .set({ stage: input.stage, appliedOn, updatedAt: new Date() })
      .where(
        and(eq(internshipApplications.userId, userId), eq(internshipApplications.id, input.id)),
      );
    await tx.insert(applicationStageHistory).values({
      userId,
      applicationId: input.id,
      fromStage: current.stage,
      toStage: input.stage,
      stageOn,
    });
    return { success: 'Application stage recorded in history.' };
  });
  if (result.success) refresh();
  return result;
}
export async function deleteApplicationAction(
  _: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const id = z.uuid().safeParse(form.get('id'));
  if (!id.success) return fail('Choose a valid opportunity to delete.');
  const deleted = await db
    .delete(internshipApplications)
    .where(and(eq(internshipApplications.userId, userId), eq(internshipApplications.id, id.data)))
    .returning({ id: internshipApplications.id });
  if (!deleted.length) return fail('Opportunity not found.');
  refresh();
  return { success: 'Opportunity deleted.' };
}
export async function createApplicationFollowUpAction(
  _: LifeActionState,
  form: FormData,
): Promise<LifeActionState> {
  const userId = (await requireUser()).id;
  const id = z.uuid().safeParse(form.get('id'));
  if (!id.success) return bad(id.error);
  const result = await db.transaction(async (tx) => {
    const application = (
      await tx
        .select()
        .from(internshipApplications)
        .where(
          and(eq(internshipApplications.userId, userId), eq(internshipApplications.id, id.data)),
        )
        .for('update')
        .limit(1)
    )[0];
    if (!application) return fail('Application not found.');
    if (!application.followUpDate) return fail('Choose a follow-up date first.');
    if (application.followUpTaskId) return fail('Follow-up task already exists.');
    const [task] = await tx
      .insert(tasks)
      .values({
        userId,
        title: `Follow up: ${application.company}`.slice(0, 160),
        area: 'Career',
        dueDate: application.followUpDate,
        status: 'todo',
        details: `${application.roleTitle} (${application.roleTrack})`,
      })
      .returning({ id: tasks.id });
    await tx
      .update(internshipApplications)
      .set({ followUpTaskId: task.id, updatedAt: new Date() })
      .where(
        and(eq(internshipApplications.userId, userId), eq(internshipApplications.id, id.data)),
      );
    return { success: 'Ordinary follow-up task created.' };
  });
  if (result.success) refresh();
  return result;
}
