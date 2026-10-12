import { Suspense } from 'react';
import { requireUser } from '@/lib/auth/session';
import { getUserSettings } from '@/lib/dal/user-settings';
import { getHistoricalHabitsByUser } from '@/lib/dal/habits';
import {
  getEntriesByUserAndDateRange,
  getActiveHabitCompletionsThrough,
} from '@/lib/dal/habit-entries';
import { MonthNavigator } from '@/components/layout/month-navigator';
import { HabitGrid } from '@/components/dashboard/habit-grid';
import { AnalyticsPanel } from '@/components/dashboard/analytics-panel';
import { HomeWeightCard } from '@/components/dashboard/home-weight-card';
import { GridSkeleton } from '@/components/shared/loading-skeleton';
import { getGoals } from '@/lib/dal/life';
import { weightTrend } from '@/lib/evidence/summary';
import { normalizeLifeArea } from '@/lib/life-areas';
import { addCalendarDays } from '@/lib/planning/time-blocks';
import { db } from '@/lib/db';
import { metricEntries } from '@/lib/db/schema';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import {
  getDaysInMonth,
  getTodayInTimezone,
  currentYearMonth,
  parseYearMonth,
  toDateString,
  isValidYearMonth,
  serverNow,
} from '@/lib/utils/date';
import { calculateCompletionRate } from '@/lib/analytics/completion';
import { calculateStreaks } from '@/lib/analytics/streak';
import { getNoteByUserAndDate } from '@/lib/dal/notes';
import { format } from 'date-fns';
import { isHabitActiveOn, weekStart } from '@/lib/analytics/habit-month-progress';

interface DashboardPageProps {
  searchParams: Promise<{ month?: string }>;
}

export const metadata = { title: 'Home | LifeOS' };

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const userId = (await requireUser()).id;
  const settings = await getUserSettings(userId);

  const params = await searchParams;
  const today = getTodayInTimezone(settings.timezone);
  const selectedMonth =
    params.month && isValidYearMonth(params.month)
      ? params.month
      : currentYearMonth(settings.timezone);

  const { year, month } = parseYearMonth(selectedMonth);
  const daysInMonth = getDaysInMonth(year, month);
  const calendarDays = daysInMonth.map((day) => ({
    date: toDateString(day),
    day: day.getDate(),
    weekday: format(day, 'EEE'),
    dayOfWeek: day.getDay(),
  }));

  // Fetch habits + month entries in parallel
  const todayStr = toDateString(today);
  const expandedStart = weekStart(calendarDays[0].date, settings.weekStartsOn);
  const lastWeekStart = weekStart(calendarDays.at(-1)!.date, settings.weekStartsOn);
  const [wy, wm, wd] = lastWeekStart.split('-').map(Number);
  const expandedEnd = new Date(Date.UTC(wy, wm - 1, wd + 6)).toISOString().slice(0, 10);
  const monthEnd = calendarDays.at(-1)?.date ?? todayStr;
  const streakCutoff = monthEnd < todayStr ? monthEnd : todayStr;
  const chartWeekStart = weekStart(streakCutoff, settings.weekStartsOn);
  const eightWeekStart = addCalendarDays(chartWeekStart, -49);
  const weightSince = addCalendarDays(todayStr, -29);
  const [
    allHabits,
    entries,
    weeklyEntries,
    todayNote,
    goals,
    recentWeights,
    latestWeight,
    streakEntries,
  ] = await Promise.all([
    getHistoricalHabitsByUser(userId),
    getEntriesByUserAndDateRange(userId, expandedStart, expandedEnd),
    getEntriesByUserAndDateRange(userId, eightWeekStart, streakCutoff),
    getNoteByUserAndDate(userId, todayStr),
    getGoals(userId),
    db
      .select({ date: metricEntries.date, value: metricEntries.value })
      .from(metricEntries)
      .where(
        and(
          eq(metricEntries.userId, userId),
          eq(metricEntries.type, 'Body weight'),
          eq(metricEntries.unit, 'kg'),
          gte(metricEntries.date, weightSince),
          lte(metricEntries.date, todayStr),
        ),
      ),
    db
      .select({ date: metricEntries.date, value: metricEntries.value })
      .from(metricEntries)
      .where(
        and(
          eq(metricEntries.userId, userId),
          eq(metricEntries.type, 'Body weight'),
          eq(metricEntries.unit, 'kg'),
          lte(metricEntries.date, todayStr),
        ),
      )
      .orderBy(desc(metricEntries.date), desc(metricEntries.createdAt))
      .limit(1),
    getActiveHabitCompletionsThrough(userId, streakCutoff),
  ]);
  const weightPoints = weightTrend(recentWeights, settings.weekStartsOn, null).daily;
  const fitnessGoal = goals.find(
    (goal) =>
      !goal.archivedAt && normalizeLifeArea(goal.area) === 'Fitness' && goal.targetUnit === 'kg',
  );
  const habits = allHabits.filter(
    (habit) =>
      calendarDays.some((day) => isHabitActiveOn(habit, day.date)) ||
      entries.some(
        (entry) =>
          entry.habitId === habit.id && calendarDays.some((day) => day.date === entry.date),
      ),
  );

  const stats = calculateCompletionRate(habits, entries, daysInMonth, today);
  const streaks = calculateStreaks(streakEntries, streakCutoff);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[.15em] text-primary">
            Build better, every day
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight">LifeOS</h1>
          <p className="text-sm text-muted-foreground">Your monthly progress at a glance.</p>
          {habits.some((habit) =>
            habit.scheduleRevisions.some((revision) => revision.source === 'legacy'),
          ) && (
            <p className="text-xs text-muted-foreground">
              Older completions remain visible; schedule obligations before the legacy baseline are
              unknown.
            </p>
          )}
        </div>
        <Suspense fallback={null}>
          <MonthNavigator currentMonth={selectedMonth} timezone={settings.timezone} />
        </Suspense>
      </div>

      <div className="space-y-6">
        <Suspense fallback={<GridSkeleton />}>
          <HabitGrid
            habits={habits}
            entries={entries}
            days={calendarDays}
            today={toDateString(today)}
            timezone={settings.timezone}
            clockStartedAt={serverNow().toISOString()}
            weekStartsOn={settings.weekStartsOn}
          />
        </Suspense>

        <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
          <AnalyticsPanel
            habits={habits}
            entries={entries}
            weeklyHabits={allHabits}
            weeklyEntries={weeklyEntries}
            weeklyCutoff={streakCutoff}
            weekStartsOn={settings.weekStartsOn}
            daysInMonth={daysInMonth}
            today={today}
            stats={stats}
            currentStreak={streaks.current}
            bestStreak={streaks.best}
            streakCutoff={streakCutoff}
            note={todayNote?.content ?? ''}
          />
        </Suspense>
        <HomeWeightCard
          points={weightPoints}
          latest={latestWeight[0] ?? null}
          target={fitnessGoal?.targetValue ?? null}
          today={todayStr}
        />
      </div>
    </div>
  );
}
