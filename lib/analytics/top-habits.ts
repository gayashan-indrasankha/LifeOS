import type { SelectHabit, SelectHabitEntry, TopHabit } from '@/types';
import { scheduleStats } from './habit-month-progress';
import { format } from 'date-fns';

/**
 * Rank habits by their completion rate in the given month,
 * returning the top N habits.
 */
export function calculateTopHabits(
  habits: SelectHabit[],
  entries: SelectHabitEntry[],
  daysInMonth: Date[],
  today: Date,
  limit = 5,
): TopHabit[] {
  if (habits.length === 0) return [];

  const todayStr = format(today, 'yyyy-MM-dd');
  const completedByHabit = new Map<string, Set<string>>();
  for (const entry of entries) {
    if (!entry.completed) continue;
    const dates = completedByHabit.get(entry.habitId) ?? new Set<string>();
    dates.add(entry.date);
    completedByHabit.set(entry.habitId, dates);
  }
  const days = daysInMonth.map((day) => ({
    date: format(day, 'yyyy-MM-dd'),
    day: day.getDate(),
    weekday: '',
    dayOfWeek: day.getDay(),
  }));

  return habits
    .map((habit) => {
      const { total, completed } = scheduleStats(
        habit,
        days,
        completedByHabit.get(habit.id) ?? new Set<string>(),
        todayStr,
      );

      return {
        habit,
        rate: total === 0 ? 0 : Math.round((completed / total) * 100),
        completed,
        total,
      };
    })
    .filter((item) => item.total > 0)
    .sort(
      (a, b) =>
        b.rate - a.rate ||
        b.completed - a.completed ||
        a.habit.name.localeCompare(b.habit.name) ||
        a.habit.id.localeCompare(b.habit.id),
    )
    .slice(0, limit);
}
