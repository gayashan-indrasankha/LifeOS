import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TopHabit } from '@/types';

interface TopHabitsListProps {
  topHabits: TopHabit[];
}

export function TopHabitsList({ topHabits }: TopHabitsListProps) {
  return (
    <Card className="analytics-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Top fixed-schedule habits</CardTitle>
      </CardHeader>
      <CardContent>
        {topHabits.length === 0 ? (
          <p className="flex min-h-32 items-center justify-center text-center text-sm text-muted-foreground">
            No data yet
          </p>
        ) : (
          <ol className="space-y-3">
            {topHabits.map((item, index) => (
              <li key={item.habit.id} className="flex items-center gap-3">
                <span className="w-4 shrink-0 text-xs font-bold text-muted-foreground">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <span className="line-clamp-2 min-w-0 text-sm font-medium sm:truncate sm:text-xs">
                      {item.habit.name}
                    </span>
                    <span className="ml-2 shrink-0 text-xs tabular-nums text-muted-foreground">
                      {item.rate}%
                    </span>
                  </div>
                  <div
                    className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuenow={item.rate}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${item.habit.name} completion rate`}
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${item.rate}%` }}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
