'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HabitRow } from './habit-row';
import type { CalendarDay } from '@/lib/analytics/habit-month-progress';
import type { SelectHabit, SelectHabitEntry } from '@/types';

interface HabitGridProps {
  habits: SelectHabit[];
  entries: SelectHabitEntry[];
  days: CalendarDay[];
  today: string;
  timezone: string;
  clockStartedAt: string;
  weekStartsOn?: number;
}

function dateInTimezone(instant: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function HabitGrid({
  habits,
  entries,
  days,
  today,
  timezone,
  clockStartedAt,
  weekStartsOn = 1,
}: HabitGridProps) {
  const [currentDay, setCurrentDay] = useState(today);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mountedAt = Date.now();
    const initialTime = Date.parse(clockStartedAt);
    const refreshDay = () =>
      setCurrentDay(dateInTimezone(new Date(initialTime + Date.now() - mountedAt), timezone));
    refreshDay();
    const timer = window.setInterval(refreshDay, 1000);
    document.addEventListener('visibilitychange', refreshDay);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshDay);
    };
  }, [clockStartedAt, timezone]);

  useLayoutEffect(() => {
    const scrollArea = scrollRef.current;
    if (!scrollArea) return;
    const mobile = window.matchMedia('(max-width: 639px)');

    const showCurrentDay = () => {
      if (!mobile.matches) {
        scrollArea.style.removeProperty('--habit-day-width');
        return;
      }
      const fixedHeaders = scrollArea.querySelectorAll<HTMLElement>('[data-fixed-column]');
      const fixedWidth = Array.from(fixedHeaders).reduce(
        (width, header) => width + header.getBoundingClientRect().width,
        0,
      );
      scrollArea.style.setProperty(
        '--habit-day-width',
        `${Math.max(44, scrollArea.clientWidth - fixedWidth)}px`,
      );
      const dayHeader = Array.from(scrollArea.querySelectorAll<HTMLElement>('[data-habit-date]'))
        .find((header) => header.dataset.habitDate === currentDay);
      if (!dayHeader) {
        scrollArea.scrollLeft = 0;
        return;
      }
      const dayLeft = dayHeader.getBoundingClientRect().left
        - scrollArea.getBoundingClientRect().left + scrollArea.scrollLeft;
      scrollArea.scrollLeft = dayLeft - fixedWidth;
    };

    showCurrentDay();
    const observer = new ResizeObserver(showCurrentDay);
    observer.observe(scrollArea);
    mobile.addEventListener('change', showCurrentDay);
    return () => {
      observer.disconnect();
      mobile.removeEventListener('change', showCurrentDay);
    };
  }, [days, currentDay]);

  if (habits.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed bg-card px-6 py-16 text-center shadow-sm">
        <PlusCircle aria-hidden="true" className="mx-auto mb-4 h-9 w-9 text-primary" />
        <h2 className="text-lg font-semibold">Your tracker starts here</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          Create a habit to see its month at a glance.
        </p>
        <Button asChild className="mt-5">
          <Link href="/habits/new">Create a habit</Link>
        </Button>
      </section>
    );
  }

  const completedByHabit = new Map<string, string[]>();
  for (const entry of entries) {
    if (!entry.completed) continue;
    const dates = completedByHabit.get(entry.habitId) ?? [];
    dates.push(entry.date);
    completedByHabit.set(entry.habitId, dates);
  }

  const weeks: CalendarDay[][] = [];
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }

  return (
    <section
      aria-label="Monthly tracker"
      className="min-w-0 overflow-hidden rounded-2xl border bg-card shadow-[0_10px_35px_rgba(25,48,100,.08)]"
    >
      <div className="flex flex-col items-start gap-2 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <h2 className="font-bold tracking-tight">Monthly habits</h2>
          <p className="text-xs text-muted-foreground">
            Check off today’s habits. Past days are locked after midnight. Scroll to see the month.
          </p>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          {habits.length} {habits.length === 1 ? 'habit' : 'habits'}
        </span>
      </div>
      <div
        ref={scrollRef}
        className="habit-grid-scroll themed-scrollbar w-full max-w-full overflow-x-auto overscroll-x-contain"
        tabIndex={0}
        aria-label="Scroll monthly tracker horizontally"
      >
        <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
          <caption className="sr-only">
            Habits, monthly goals, progress, and daily completion for the selected month
          </caption>
          <thead>
            <tr className="bg-primary text-[11px] font-bold uppercase tracking-wide text-primary-foreground">
              <th
                scope="col"
                rowSpan={2}
                data-fixed-column="habit"
                className="sticky left-0 z-20 w-32 min-w-32 max-w-32 border-r border-white/20 bg-primary px-2 py-3 text-left min-[375px]:w-36 min-[375px]:min-w-36 min-[375px]:max-w-36 min-[420px]:w-40 min-[420px]:min-w-40 min-[420px]:max-w-40 sm:w-48 sm:min-w-48 sm:max-w-48 sm:px-4"
              >
                Habit
              </th>
              <th
                scope="col"
                rowSpan={2}
                data-fixed-column="goal"
                className="habit-grid-goal w-14 min-w-14 border-r border-white/20 px-1 py-3 text-center sm:w-20 sm:min-w-20 sm:px-2"
              >
                Goal
              </th>
              <th
                scope="col"
                rowSpan={2}
                data-fixed-column="progress"
                className="habit-grid-progress w-24 min-w-24 border-r border-white/20 px-2 py-3 text-left sm:w-28 sm:min-w-28"
              >
                Progress
              </th>
              {weeks.map((week, index) => (
                <th
                  scope="colgroup"
                  key={week[0]?.date}
                  colSpan={week.length}
                  className="whitespace-nowrap border-r border-white/20 px-1 py-2 text-center"
                >
                  Week {index + 1}
                </th>
              ))}
            </tr>
            <tr className="bg-[#f5f7fc] text-xs font-semibold text-[#2e3b58] dark:bg-muted dark:text-foreground">
              {days.map((day) => (
                <th
                  scope="col"
                  key={day.date}
                  data-habit-date={day.date}
                  title={day.date}
                  className={`habit-grid-day w-11 min-w-11 border-b border-r px-0 py-2 text-center sm:w-10 sm:min-w-10 ${day.date === currentDay ? 'sm:bg-primary/10 sm:text-primary' : day.dayOfWeek === 0 || day.dayOfWeek === 6 ? 'bg-slate-100 dark:bg-muted/60' : ''}`}
                >
                  <span className="block text-[10px] font-medium">{day.weekday}</span>
                  <span className="block text-xs font-bold">{day.day}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {habits.map((habit) => (
              <HabitRow
                key={`${habit.id}:${days[0]?.date}`}
                habit={habit}
                days={days}
                today={currentDay}
                weekStartsOn={weekStartsOn}
                initialCompletedDates={completedByHabit.get(habit.id) ?? []}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
