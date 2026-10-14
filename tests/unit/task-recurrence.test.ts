import { describe, expect, it } from 'vitest';
import { occursOn, taskOccurrences, type Task } from '@/lib/planning/task-recurrence';
import { TaskSchema } from '@/lib/validations/life';

const task = {
  id: 'task-1',
  title: 'Review notes',
  scheduledDate: '2026-10-15',
  dueDate: '2026-10-21',
  recurrence: 'daily',
  weekdays: null,
  status: 'todo',
  dailyPriority: null,
} as Task;

describe('repeating tasks', () => {
  it('creates a separate daily occurrence within inclusive dates', () => {
    const dates = taskOccurrences(
      [task],
      '2026-10-14',
      '2026-10-22',
      new Set(['task-1:2026-10-16']),
    );
    expect(dates.map((item) => item.scheduledDate)).toEqual([
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
      '2026-10-18',
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
    ]);
    expect(dates.map((item) => item.status)).toEqual([
      'todo',
      'done',
      'todo',
      'todo',
      'todo',
      'todo',
      'todo',
    ]);
  });

  it('uses Monday-first selected weekdays', () => {
    const weekly = { ...task, recurrence: 'weekly', weekdays: '1100001' };
    expect(occursOn(weekly, '2026-10-19')).toBe(true);
    expect(occursOn(weekly, '2026-10-20')).toBe(true);
    expect(occursOn(weekly, '2026-10-18')).toBe(true);
    expect(occursOn(weekly, '2026-10-21')).toBe(false);
    expect(occursOn(weekly, '2026-10-22')).toBe(false);
  });

  it('carries an unfinished one-time task through its end date and stops after completion', () => {
    const once = { ...task, recurrence: 'once' };
    const open = taskOccurrences([once], '2026-10-14', '2026-10-22', new Set());
    expect(open.map((item) => item.scheduledDate)).toEqual([
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
      '2026-10-18',
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
    ]);

    const completed = taskOccurrences(
      [{ ...once, status: 'done', completedAt: new Date('2026-10-17T18:45:00Z') }],
      '2026-10-14',
      '2026-10-22',
      new Set(),
      'Asia/Colombo',
    );
    expect(completed.map((item) => [item.scheduledDate, item.status])).toEqual([
      ['2026-10-18', 'done'],
    ]);
  });

  it('keeps an undated one-time deadline open until it is marked', () => {
    const once = { ...task, recurrence: 'once', dueDate: null };
    expect(occursOn(once, '2026-10-14')).toBe(false);
    expect(occursOn(once, '2026-10-22')).toBe(true);
  });

  it('requires a bounded range and a selected weekday for weekly tasks', () => {
    const input = {
      title: 'Review notes',
      details: '',
      area: 'Education & Skills',
      priority: 2,
      estimatedMinutes: '',
      scheduledDate: '2026-10-15',
      dueDate: '',
      goalId: '',
      projectId: '',
      isMilestone: false,
      recurrence: 'weekly',
      weekdays: '0000000',
    };
    expect(TaskSchema.safeParse(input).success).toBe(false);
    expect(
      TaskSchema.safeParse({ ...input, dueDate: '2026-10-21', weekdays: '1000000' }).success,
    ).toBe(true);
  });
});
