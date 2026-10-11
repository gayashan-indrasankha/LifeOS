import { describe, expect, it } from 'vitest';
import {
  isFixedOccurrence,
  isGridApplicable,
  scheduleStats,
  weeklyQuotaAttainment,
  weekStart,
} from '@/lib/analytics/habit-month-progress';
import { UserSettingsSchema } from '@/lib/validations/settings';
import { toDateString, toZonedTime } from '@/lib/utils/date';

const habit = { schedule: 'weekly:4', startDate: '2024-02-01', endDate: null };

describe('schedule policy', () => {
  it('distinguishes daily, weekdays, weekends, custom masks, and bounded dates', () => {
    const base = { startDate: '2026-10-05', endDate: '2026-10-10' };
    expect(isFixedOccurrence({ ...base, schedule: 'daily' }, '2026-10-05', 1)).toBe(true);
    expect(isFixedOccurrence({ ...base, schedule: 'weekdays' }, '2026-10-10', 6)).toBe(false);
    expect(isFixedOccurrence({ ...base, schedule: 'weekends' }, '2026-10-10', 6)).toBe(true);
    expect(isFixedOccurrence({ ...base, schedule: 'custom:0100000' }, '2026-10-06', 2)).toBe(true);
    expect(isFixedOccurrence({ ...base, schedule: 'daily' }, '2026-10-11', 0)).toBe(false);
    expect(scheduleStats({ ...base, schedule: 'daily' }, [], new Set(), '2026-10-10')).toEqual({
      total: 0,
      completed: 0,
    });
  });
  it('does not turn a flexible quota into seven daily obligations', () => {
    const day = { date: '2024-02-29', day: 29, weekday: 'Thu', dayOfWeek: 4 };
    expect(isGridApplicable(habit, day, [day], new Set())).toBe(true);
    expect(scheduleStats(habit, [day], new Set([day.date]), day.date)).toEqual({
      total: 0,
      completed: 0,
    });
    expect(isFixedOccurrence(habit, day.date, 4)).toBe(false);
  });

  it('uses the complete week across leap-month boundaries and configurable starts', () => {
    const dates = new Set(['2024-02-29', '2024-03-01', '2024-03-02', '2024-03-03']);
    expect(weekStart('2024-03-01', 1)).toBe('2024-02-26');
    expect(weekStart('2024-03-01', 0)).toBe('2024-02-25');
    expect(weeklyQuotaAttainment(habit, '2024-03-01', dates, '2024-03-03', 1)).toEqual({
      goal: 4,
      completed: 4,
      achieved: true,
    });
  });

  it('respects start and end dates without penalizing rest days', () => {
    const bounded = { ...habit, startDate: '2024-03-01', endDate: '2024-03-02' };
    expect(
      weeklyQuotaAttainment(bounded, '2024-03-01', new Set(['2024-03-01']), '2024-03-03'),
    ).toEqual({ goal: 2, completed: 1, achieved: false });
    expect(isFixedOccurrence({ ...habit, schedule: 'weekdays' }, '2024-03-03', 0)).toBe(false);
  });

  it('accepts Colombo and rejects invalid timezone identifiers', () => {
    expect(
      UserSettingsSchema.safeParse({ timezone: 'Asia/Colombo', weekStartsOn: 1, theme: 'system' })
        .success,
    ).toBe(true);
    expect(
      UserSettingsSchema.safeParse({ timezone: 'Moon/Base', weekStartsOn: 1, theme: 'system' })
        .success,
    ).toBe(false);
  });

  it('keeps a Colombo calendar date when UTC is still on the previous day', () => {
    const instant = new Date('2026-10-07T20:00:00Z');
    expect(toDateString(toZonedTime(instant, 'Asia/Colombo'))).toBe('2026-10-08');
    expect(toDateString(toZonedTime(instant, 'UTC'))).toBe('2026-10-07');
  });

  it('keeps dated daily history through a future quota change, archive, and restore', () => {
    const versioned = {
      schedule: 'weekly:3',
      startDate: '2026-12-28',
      endDate: null,
      archived: false,
      scheduleRevisions: [
        {
          effectiveDate: '2026-12-28',
          schedule: 'daily',
          startDate: '2026-12-28',
          endDate: null,
          status: 'active',
        },
        {
          effectiveDate: '2027-01-04',
          schedule: 'weekly:3',
          startDate: '2026-12-28',
          endDate: null,
          status: 'active',
        },
        {
          effectiveDate: '2027-01-11',
          schedule: 'weekly:3',
          startDate: '2026-12-28',
          endDate: null,
          status: 'archived',
        },
        {
          effectiveDate: '2027-01-18',
          schedule: 'weekly:3',
          startDate: '2026-12-28',
          endDate: null,
          status: 'active',
        },
      ],
    };
    const days = ['2026-12-31', '2027-01-01', '2027-01-02'].map((date) => ({
      date,
      day: Number(date.slice(-2)),
      weekday: '',
      dayOfWeek: new Date(`${date}T12:00:00Z`).getUTCDay(),
    }));
    expect(
      scheduleStats(
        versioned,
        days,
        new Set(days.slice(0, 2).map((day) => day.date)),
        '2027-01-02',
      ),
    ).toEqual({ total: 3, completed: 2 });
    expect(isFixedOccurrence(versioned, '2027-01-05', 2)).toBe(false);
    expect(
      weeklyQuotaAttainment(versioned, '2027-01-05', new Set(['2027-01-05']), '2027-01-10'),
    ).toEqual({ goal: 3, completed: 1, achieved: false });
    expect(
      isGridApplicable(
        versioned,
        { date: '2027-01-12', day: 12, weekday: '', dayOfWeek: 2 },
        [],
        new Set(),
      ),
    ).toBe(false);
    expect(
      isGridApplicable(
        versioned,
        { date: '2027-01-19', day: 19, weekday: '', dayOfWeek: 2 },
        [],
        new Set(),
      ),
    ).toBe(true);
  });

  it('keeps earlier flexible checks when a habit is restored during the same week', () => {
    const versioned = {
      schedule: 'weekly:3',
      startDate: '2027-01-04',
      endDate: null,
      scheduleRevisions: [
        {
          effectiveDate: '2027-01-04',
          schedule: 'weekly:3',
          startDate: '2027-01-04',
          endDate: null,
          status: 'active',
        },
        {
          effectiveDate: '2027-01-06',
          schedule: 'weekly:3',
          startDate: '2027-01-04',
          endDate: null,
          status: 'archived',
        },
        {
          effectiveDate: '2027-01-08',
          schedule: 'weekly:3',
          startDate: '2027-01-04',
          endDate: null,
          status: 'active',
        },
      ],
    };
    expect(
      weeklyQuotaAttainment(
        versioned,
        '2027-01-08',
        new Set(['2027-01-04', '2027-01-08']),
        '2027-01-08',
      ),
    ).toEqual({ goal: 3, completed: 2, achieved: false });
  });

  it('does not count earlier fixed-schedule checks toward a new weekly quota', () => {
    const versioned = {
      schedule: 'weekly:3',
      startDate: '2027-01-04',
      endDate: null,
      scheduleRevisions: [
        {
          effectiveDate: '2027-01-04',
          schedule: 'daily',
          startDate: '2027-01-04',
          endDate: null,
          status: 'active',
        },
        {
          effectiveDate: '2027-01-06',
          schedule: 'weekly:3',
          startDate: '2027-01-04',
          endDate: null,
          status: 'active',
        },
      ],
    };
    expect(
      weeklyQuotaAttainment(
        versioned,
        '2027-01-08',
        new Set(['2027-01-04', '2027-01-08']),
        '2027-01-08',
      ),
    ).toEqual({ goal: 3, completed: 1, achieved: false });
  });

  it('does not infer missing obligations before a legacy baseline', () => {
    const legacy = {
      schedule: 'daily',
      startDate: '2026-01-01',
      endDate: null,
      scheduleRevisions: [
        {
          effectiveDate: '2026-10-09',
          schedule: 'daily',
          startDate: '2026-01-01',
          endDate: null,
          status: 'active',
        },
      ],
    };
    expect(isFixedOccurrence(legacy, '2026-01-02', 5)).toBe(false);
    expect(isFixedOccurrence(legacy, '2026-10-09', 5)).toBe(true);
    const days = [
      { date: '2026-10-08', day: 8, weekday: 'Thu', dayOfWeek: 4 },
      { date: '2026-10-09', day: 9, weekday: 'Fri', dayOfWeek: 5 },
    ];
    expect(scheduleStats(legacy, days, new Set(), '2026-10-09')).toEqual({
      total: 1,
      completed: 0,
    });
    expect(scheduleStats(legacy, days, new Set(['2026-10-08']), '2026-10-09')).toEqual({
      total: 2,
      completed: 1,
    });
  });
});
