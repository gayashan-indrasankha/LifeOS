import { z } from 'zod';

const optionalDate = z.union([z.iso.date(), z.literal('')]).transform((value) => value || null);
const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .transform((value) => value.trim() || null);
const optionalId = z.union([z.uuid(), z.literal('')]).transform((value) => value || null);
const title = z.string().trim().min(1).max(160);
const area = z.string().trim().min(1).max(80);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm time');

export const GoalSchema = z.object({
  area,
  title,
  description: optionalText(2000),
  targetDate: optionalDate,
  priority: z.coerce.number().int().min(1).max(3),
  targetValue: z
    .union([z.literal(''), z.coerce.number().finite().nonnegative()])
    .transform((value) => (value === '' ? null : value)),
  targetUnit: optionalText(32),
});

export const ProjectSchema = z.object({
  name: title,
  description: optionalText(2000),
  type: z.enum([
    'UCSC Industry Project',
    'Software Engineering Portfolio',
    'DevOps Portfolio',
    'General',
  ]),
  goalId: optionalId,
  deadline: optionalDate,
  repositoryUrl: z
    .union([z.url({ protocol: /^https?$/ }), z.literal('')])
    .transform((value) => value || null),
});

export const TaskSchema = z
  .object({
    title,
    details: optionalText(4000),
    area,
    priority: z.coerce.number().int().min(1).max(3),
    estimatedMinutes: z
      .union([z.literal(''), z.coerce.number().int().min(1).max(1440)])
      .transform((value) => (value === '' ? null : value)),
    dueDate: optionalDate,
    scheduledDate: optionalDate,
    recurrence: z.enum(['once', 'daily', 'weekly']).default('once'),
    weekdays: z
      .string()
      .regex(/^[01]{7}$/)
      .nullable()
      .optional(),
    goalId: optionalId,
    projectId: optionalId,
    isMilestone: z.boolean(),
  })
  .superRefine((task, ctx) => {
    if (task.recurrence !== 'once') {
      if (!task.scheduledDate || !task.dueDate || task.dueDate < task.scheduledDate)
        ctx.addIssue({
          code: 'custom',
          path: ['dueDate'],
          message: 'Repeating tasks need a start date and an end date on or after it.',
        });
      if (task.recurrence === 'weekly' && (!task.weekdays || !task.weekdays.includes('1')))
        ctx.addIssue({
          code: 'custom',
          path: ['weekdays'],
          message: 'Choose at least one weekday.',
        });
    }
  });

export const BlockSchema = z
  .object({
    title,
    category: area,
    localStartTime: time,
    localEndTime: time,
    weekdayMask: z
      .string()
      .regex(/^[01]{7}$/)
      .refine((value) => value.includes('1'), 'Select at least one day'),
    startDate: z.iso.date(),
    endDate: optionalDate,
    isFixed: z.boolean(),
    taskId: optionalId,
    goalId: optionalId,
    projectId: optionalId,
    allowOverlap: z.boolean(),
  })
  .refine((value) => value.localEndTime > value.localStartTime, {
    path: ['localEndTime'],
    message: 'End must be after start',
  })
  .refine((value) => !value.endDate || value.endDate >= value.startDate, {
    path: ['endDate'],
    message: 'End date must follow start date',
  });

export const ExceptionSchema = z.object({
  blockId: z.uuid(),
  occurrenceDate: z.iso.date(),
  status: z.enum(['started', 'completed', 'skipped', 'rescheduled', 'planned']),
  overrideDate: optionalDate,
  overrideStartTime: z.union([time, z.literal('')]).transform((value) => value || null),
  overrideEndTime: z.union([time, z.literal('')]).transform((value) => value || null),
  reason: optionalText(500),
  allowOverlap: z.boolean(),
});

export const MetricSchema = z.object({
  date: z.iso.date(),
  type: area,
  value: z.coerce.number().finite().min(0).max(100000),
  unit: z.string().trim().min(1).max(24),
  note: optionalText(500),
});

export const SubjectSchema = z.object({
  slot: z.coerce.number().int().min(1).max(5),
  name: optionalText(120),
  targetGrade: optionalText(20),
  actualGrade: optionalText(20),
});

export const DayModeSchema = z.enum(['normal', 'reduced', 'minimum']);
