import type { SelectHabit, SelectHabitEntry, CompletionStats } from '@/types';
import { format } from 'date-fns';
import { isFixedOccurrence, isScheduledWeekday } from './habit-month-progress';

/**
 * Calculate overall completion rate for a set of habits and entries in a month.
 *
 * For each active (non-archived) habit, counts days where the habit was scheduled
 * (up to today for current month) and days where it was completed.
 */
export function calculateCompletionRate(
  habits: SelectHabit[],
  entries: SelectHabitEntry[],
  daysInMonth: Date[],
  today: Date,
): CompletionStats {
  if (habits.length === 0 || daysInMonth.length === 0) {
    return { rate: 0, completed: 0, total: 0 };
  }

  const entrySet = new Set(entries.filter((e) => e.completed).map((e) => `${e.habitId}:${e.date}`));

  let totalPossible = 0;
  let totalCompleted = 0;

  const todayStr = formatDateStr(today);
  const elapsedDays = daysInMonth
    .map((day) => ({ date: formatDateStr(day), weekday: day.getDay() }))
    .filter((day) => day.date <= todayStr);

  for (const habit of habits) {
    for (const { date: dayStr, weekday } of elapsedDays) {
      // Don't count days before habit started
      if (!isFixedOccurrence(habit, dayStr, weekday)) continue;

      totalPossible++;
      if (entrySet.has(`${habit.id}:${dayStr}`)) {
        totalCompleted++;
      }
    }
  }

  return {
    rate: totalPossible === 0 ? 0 : Math.round((totalCompleted / totalPossible) * 100),
    completed: totalCompleted,
    total: totalPossible,
  };
}

function formatDateStr(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Check if a habit is scheduled for a given day of the week.
 */
export function isScheduledDay(schedule: string, date: Date): boolean {
  return isScheduledWeekday(schedule, date.getDay());
}
