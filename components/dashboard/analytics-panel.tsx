import type { SelectHabit, SelectHabitEntry, CompletionStats } from '@/types';
import { calculateDailyProgress } from '@/lib/analytics/daily-progress';
import { calculateEightWeekSummary } from '@/lib/analytics/weekly-summary';
import { calculateTopHabits } from '@/lib/analytics/top-habits';
import { CompletionDonut } from '@/components/analytics/completion-donut';
import { DailyLineChart } from '@/components/analytics/daily-line-chart';
import { WeeklyBarChart } from '@/components/analytics/weekly-bar-chart';
import { TopHabitsList } from '@/components/analytics/top-habits-list';
import { ProgressSummary } from '@/components/dashboard/progress-summary';
import { NotesPreview } from '@/components/dashboard/notes-preview';

interface AnalyticsPanelProps {
  habits: SelectHabit[];
  entries: SelectHabitEntry[];
  weeklyHabits: SelectHabit[];
  weeklyEntries: SelectHabitEntry[];
  weeklyCutoff: string;
  weekStartsOn: number;
  daysInMonth: Date[];
  today: Date;
  stats: CompletionStats;
  currentStreak: number;
  bestStreak: number;
  streakCutoff: string;
  note: string;
}

export function AnalyticsPanel({
  habits,
  entries,
  weeklyHabits,
  weeklyEntries,
  weeklyCutoff,
  weekStartsOn,
  daysInMonth,
  today,
  stats,
  currentStreak,
  bestStreak,
  streakCutoff,
  note,
}: AnalyticsPanelProps) {
  const dailyProgress = calculateDailyProgress(habits, entries, daysInMonth, today);
  const weeklySummary = calculateEightWeekSummary(
    weeklyHabits,
    weeklyEntries,
    weeklyCutoff,
    weekStartsOn,
  );
  const topHabits = calculateTopHabits(habits, entries, daysInMonth, today, 5);

  return (
    <section
      aria-label="Habit analytics"
      className="grid min-w-0 grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-[minmax(190px,1fr)_minmax(0,2.25fr)_minmax(190px,1fr)]"
    >
      <div className="grid min-w-0 gap-4">
        <ProgressSummary
          stats={stats}
          currentStreak={currentStreak}
          bestStreak={bestStreak}
          habitCount={habits.length}
          streakCutoff={streakCutoff}
        />
        <TopHabitsList topHabits={topHabits} />
      </div>
      <div className="grid min-w-0 gap-4">
        <DailyLineChart data={dailyProgress} />
        <WeeklyBarChart data={weeklySummary} />
      </div>
      <div className="grid min-w-0 gap-4 md:col-span-2 xl:col-span-1">
        <CompletionDonut stats={stats} />
        <NotesPreview content={note} />
      </div>
    </section>
  );
}
