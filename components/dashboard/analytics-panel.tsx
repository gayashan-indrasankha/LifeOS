import type { SelectHabit, SelectHabitEntry, CompletionStats } from '@/types';
import { calculateDailyProgress } from '@/lib/analytics/daily-progress';
import { calculateEightWeekSummary } from '@/lib/analytics/weekly-summary';
import { calculateTopHabits } from '@/lib/analytics/top-habits';
import {
  LazyCompletionDonut,
  LazyDailyLineChart,
  LazyWeeklyBarChart,
} from '@/components/dashboard/lazy-analytics-charts';
import { TopHabitsList } from '@/components/analytics/top-habits-list';
import { ProgressSummary } from '@/components/dashboard/progress-summary';
import { NotesPreview } from '@/components/dashboard/notes-preview';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function EmptyChartCard({
  title,
  height = 'h-48',
  message = 'No data yet',
}: {
  title: string;
  height?: string;
  message?: string;
}) {
  return (
    <Card className="analytics-card min-w-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent
        className={`flex items-center justify-center text-center ${height === 'h-36' ? 'h-36' : 'h-48'}`}
      >
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}

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
        {dailyProgress.some((day) => day.total > 0) ? (
          <LazyDailyLineChart data={dailyProgress} />
        ) : (
          <EmptyChartCard title="Daily Progress" />
        )}
        {weeklySummary.some((week) => week.total > 0) ? (
          <LazyWeeklyBarChart data={weeklySummary} />
        ) : (
          <EmptyChartCard
            title="Scheduled habit check-ins · last 8 weeks"
            height="h-36"
            message="No scheduled habit check-ins in these eight weeks"
          />
        )}
      </div>
      <div className="grid min-w-0 gap-4 md:col-span-2 xl:col-span-1">
        {stats.total > 0 ? (
          <LazyCompletionDonut stats={stats} />
        ) : (
          <EmptyChartCard title="Scheduled habit check-ins" />
        )}
        <NotesPreview content={note} />
      </div>
    </section>
  );
}
