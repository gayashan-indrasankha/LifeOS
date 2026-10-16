import { describe, expect, it } from 'vitest';
import { format } from 'date-fns';
import { getDaysInMonth, isValidYearMonth } from '@/lib/utils/date';
import {
  habitMonthProgress,
  habitRuleOn,
  isScheduledWeekday,
} from '@/lib/analytics/habit-month-progress';

function days(year: number, month: number) {
  return getDaysInMonth(year, month).map((day) => ({
    date: format(day, 'yyyy-MM-dd'),
    day: day.getDate(),
    weekday: format(day, 'EEE'),
    dayOfWeek: day.getDay(),
  }));
}

describe('monthly calendar', () => {
  it('chooses the latest eligible revision without changing history order', () => {
    const revisions = ['2026-10-10', '2026-11-01', '2026-10-01'].map((effectiveDate) => ({
      effectiveDate,
      schedule: 'daily',
      startDate: '2026-10-01',
      endDate: null,
      status: 'active',
    }));
    const habit = { schedule: 'daily', startDate: '2026-10-01', scheduleRevisions: revisions };
    expect(habitRuleOn(habit, '2026-10-16')).toBe(revisions[0]);
    expect(habitRuleOn(habit, '2026-09-30')).toBeNull();
    expect(revisions.map((revision) => revision.effectiveDate)).toEqual([
      '2026-10-10',
      '2026-11-01',
      '2026-10-01',
    ]);
  });
  it.each([
    [2025, 2, 28],
    [2024, 2, 29],
    [2026, 4, 30],
    [2026, 10, 31],
  ])('%i-%i has %i days', (year, month, count) => {
    const monthDays = days(year, month);
    expect(monthDays).toHaveLength(count);
    expect(monthDays[0].day).toBe(1);
    expect(monthDays.at(-1)?.day).toBe(count);
  });

  it('rejects invalid month parameters', () => {
    expect(isValidYearMonth('2026-13')).toBe(false);
    expect(isValidYearMonth('2026-02')).toBe(true);
  });

  it('caps the goal by scheduled days and ignores future completions', () => {
    const monthDays = days(2026, 2);
    const completed = new Set(['2026-02-01', '2026-02-02', '2026-02-03', '2026-02-28']);
    const progress = habitMonthProgress(
      { schedule: 'weekdays', startDate: '2026-02-01', monthlyTarget: 25 },
      monthDays,
      completed,
      '2026-02-03',
    );
    expect(progress).toEqual({ completed: 2, goal: 20, percentage: 10 });
  });

  it('respects start date and custom schedules', () => {
    expect(isScheduledWeekday('custom:1000000', 1)).toBe(true);
    expect(isScheduledWeekday('custom:1000000', 2)).toBe(false);
    const progress = habitMonthProgress(
      { schedule: 'daily', startDate: '2026-04-29', monthlyTarget: 20 },
      days(2026, 4),
      new Set(['2026-04-28', '2026-04-29']),
      '2026-04-30',
    );
    expect(progress).toEqual({ completed: 1, goal: 2, percentage: 50 });
  });
});
