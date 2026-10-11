'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { DayCell } from './day-cell';
import { HabitNameTooltip } from './habit-name-tooltip';
import { toggleEntryAction } from '@/lib/actions/entry-actions';
import {
  habitMonthProgress,
  habitRuleOn,
  isGridApplicable,
  isFlexibleWeekly,
  weeklyQuotaAttainment,
  type CalendarDay,
} from '@/lib/analytics/habit-month-progress';
import type { SelectHabit } from '@/types';

interface HabitRowProps {
  habit: SelectHabit;
  days: CalendarDay[];
  today: string;
  weekStartsOn: number;
  initialCompletedDates: string[];
}

export function HabitRow({
  habit,
  days,
  today,
  weekStartsOn,
  initialCompletedDates,
}: HabitRowProps) {
  const [completedDates, setCompletedDates] = useState(() => new Set(initialCompletedDates));
  const completedRef = useRef(completedDates);
  const pendingRef = useRef(false);
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const progress = useMemo(
    () => habitMonthProgress(habit, days, completedDates, today),
    [habit, days, completedDates, today],
  );
  const displayedCutoff = today < days.at(-1)!.date ? today : days.at(-1)!.date;
  const displayedRule = habitRuleOn(habit, displayedCutoff);
  const flexible = displayedRule ? isFlexibleWeekly(displayedRule.schedule) : false;
  const weekly = flexible
    ? weeklyQuotaAttainment(habit, displayedCutoff, completedDates, displayedCutoff, weekStartsOn)
    : null;
  const displayedProgress = weekly
    ? {
        completed: weekly.completed,
        goal: weekly.goal,
        percentage: weekly.goal
          ? Math.min(100, Math.round((weekly.completed / weekly.goal) * 100))
          : 0,
      }
    : progress;

  const handleToggle = useCallback(
    async (date: string) => {
      if (pendingRef.current || date !== today) return;
      pendingRef.current = true;
      setPendingDate(date);
      setError(null);
      const wasCompleted = completedRef.current.has(date);
      const next = new Set(completedRef.current);
      if (wasCompleted) next.delete(date);
      else next.add(date);
      completedRef.current = next;
      setCompletedDates(next);

      const formData = new FormData();
      formData.set('habitId', habit.id);
      formData.set('date', date);
      formData.set('completed', String(!wasCompleted));
      try {
        const result = await toggleEntryAction({}, formData);
        if (result.error) throw new Error(result.error);
      } catch (failure) {
        const rollback = new Set(completedRef.current);
        if (wasCompleted) rollback.add(date);
        else rollback.delete(date);
        completedRef.current = rollback;
        setCompletedDates(rollback);
        setError(
          failure instanceof Error ? failure.message : 'Could not save this day. Try again.',
        );
      } finally {
        pendingRef.current = false;
        setPendingDate(null);
      }
    },
    [habit.id, today],
  );

  return (
    <tr className="group hover:bg-primary/[0.025]">
      <th
        scope="row"
        className="habit-grid-habit sticky left-0 z-10 w-32 min-w-32 max-w-32 border-b border-r bg-card px-2 py-2 text-left group-hover:bg-[#f7faff] min-[375px]:w-36 min-[375px]:min-w-36 min-[375px]:max-w-36 min-[420px]:w-40 min-[420px]:min-w-40 min-[420px]:max-w-40 sm:w-48 sm:min-w-48 sm:max-w-48 sm:border-r-0 sm:px-4 sm:py-3 dark:group-hover:bg-muted"
      >
        <HabitNameTooltip
          name={habit.name}
          icon={habit.icon}
          description={habit.description}
          archived={habit.archived}
        />
        {error && (
          <span role="alert" className="mt-1 block text-xs font-normal text-destructive">
            {error}
          </span>
        )}
      </th>
      <td className="habit-grid-goal w-14 min-w-14 border-b px-1 py-2 text-center text-xs font-semibold tabular-nums sm:w-20 sm:min-w-20 sm:px-2 sm:py-3 sm:text-sm">
        {flexible ? `${displayedRule?.schedule.split(':')[1]}/week` : progress.goal}
      </td>
      <td className="habit-grid-progress w-24 min-w-24 border-b px-2 py-2 sm:w-28 sm:min-w-28 sm:py-3">
        <div className="flex items-baseline justify-between gap-1 tabular-nums">
          <span className="text-xs font-semibold sm:text-sm">
            {displayedProgress.completed} / {displayedProgress.goal}
          </span>
          <span className="text-[11px] text-muted-foreground sm:text-xs">
            {displayedProgress.percentage}%
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-200"
            style={{ width: `${displayedProgress.percentage}%` }}
          />
        </div>
      </td>
      {days.map((day) => {
        const isEligible = isGridApplicable(habit, day, days, completedDates);
        return (
          <DayCell
            key={day.date}
            habitName={habit.name}
            date={day.date}
            isCompleted={completedDates.has(day.date)}
            isToday={day.date === today}
            isPast={day.date < today}
            isFuture={day.date > today}
            isEligible={isEligible}
            isReadOnly={habit.archived || !isEligible}
            isPending={pendingDate === day.date}
            isBusy={pendingDate !== null}
            onToggle={handleToggle}
          />
        );
      })}
    </tr>
  );
}
