import { Flame, Trophy, Activity } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { CompletionStats } from '@/types';

interface ProgressSummaryProps {
  stats: CompletionStats;
  currentStreak: number;
  bestStreak: number;
  habitCount: number;
  streakCutoff: string;
}

export function ProgressSummary({
  stats,
  currentStreak,
  bestStreak,
  habitCount,
  streakCutoff,
}: ProgressSummaryProps) {
  return (
    <Card className="analytics-card h-full">
      <div className="analytics-band text-center text-xs font-extrabold uppercase tracking-wide">
        Scheduled habit check-ins
      </div>
      <CardContent className="p-5 text-center">
        <p className="text-4xl font-extrabold tracking-tight text-primary">
          {stats.total ? `${stats.rate}%` : '—'}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {stats.total
            ? `${stats.completed} of ${stats.total} planned check-ins completed this month`
            : 'No scheduled check-ins yet'}
        </p>
        <div
          role="progressbar"
          aria-label="Scheduled habit check-ins"
          aria-valuenow={stats.rate}
          aria-valuemin={0}
          aria-valuemax={100}
          className="mt-4 h-2 overflow-hidden rounded-full bg-[#dce5fa] dark:bg-muted"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${stats.rate}%` }}
          />
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2 border-t pt-4 text-left">
          <div>
            <Flame className="mb-1 h-4 w-4 text-primary" aria-hidden="true" />
            <strong className="block text-sm">{currentStreak}</strong>
            <span className="android-progress-stat-label text-xs text-muted-foreground sm:text-[10px]">
              Current activity streak
            </span>
          </div>
          <div>
            <Trophy className="mb-1 h-4 w-4 text-primary" aria-hidden="true" />
            <strong className="block text-sm">{bestStreak}</strong>
            <span className="android-progress-stat-label text-xs text-muted-foreground sm:text-[10px]">
              Best activity streak
            </span>
          </div>
          <div>
            <Activity className="mb-1 h-4 w-4 text-primary" aria-hidden="true" />
            <strong className="block text-sm">{habitCount}</strong>
            <span className="text-xs text-muted-foreground sm:text-[10px]">Active habits</span>
          </div>
        </div>
        <p className="mt-3 text-left text-xs text-muted-foreground sm:text-[10px]">
          Any eligible completion on consecutive days through {streakCutoff}. Flexible weekly quotas
          are shown per week.
        </p>
      </CardContent>
    </Card>
  );
}
