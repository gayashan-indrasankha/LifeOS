'use client';

import dynamic from 'next/dynamic';
import type { CompletionStats, DailyProgress, WeeklySummary } from '@/types';

const DailyLineChart = dynamic(() =>
  import('@/components/analytics/daily-line-chart').then((module) => module.DailyLineChart),
);
const WeeklyBarChart = dynamic(() =>
  import('@/components/analytics/weekly-bar-chart').then((module) => module.WeeklyBarChart),
);
const CompletionDonut = dynamic(() =>
  import('@/components/analytics/completion-donut').then((module) => module.CompletionDonut),
);

export function LazyDailyLineChart({ data }: { data: DailyProgress[] }) {
  return <DailyLineChart data={data} />;
}

export function LazyWeeklyBarChart({ data }: { data: WeeklySummary[] }) {
  return <WeeklyBarChart data={data} />;
}

export function LazyCompletionDonut({ stats }: { stats: CompletionStats }) {
  return <CompletionDonut stats={stats} />;
}
