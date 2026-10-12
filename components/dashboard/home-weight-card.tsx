import Link from 'next/link';
import { Scale } from 'lucide-react';
import { LazyWeightTrend } from '@/components/life/lazy-weight-trend';

type WeightPoint = { date: string; value: number };

export function HomeWeightCard({
  points,
  latest,
  target,
  today,
}: {
  points: WeightPoint[];
  latest: WeightPoint | null;
  target: number | null;
  today: string;
}) {
  return (
    <section
      id="home-weight"
      aria-labelledby="home-weight-heading"
      className="min-w-0 rounded-2xl border bg-card p-4 shadow-sm sm:p-6"
    >
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Scale aria-hidden="true" className="size-5" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-primary">Fitness</p>
            <h2 id="home-weight-heading" className="mt-0.5 text-xl font-bold">
              Weight over time
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your measurements from the last 30 days.
            </p>
          </div>
        </div>
        <Link
          href="/today#today-weight"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 sm:min-h-10 sm:w-auto"
        >
          Record today’s weight
        </Link>
      </div>

      <div className="mt-5 grid min-w-0 gap-4 sm:gap-5 lg:grid-cols-[minmax(200px,0.7fr)_minmax(0,2fr)] lg:items-center">
        <div className="min-w-0 rounded-xl bg-muted/40 p-4">
          <p className="text-sm text-muted-foreground">Latest measurement</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">
            {latest == null ? '—' : `${latest.value.toFixed(1)} kg`}
          </p>
          {latest && (
            <p className="mt-1 text-xs text-muted-foreground">
              Recorded {latest.date === today ? 'today' : latest.date}
            </p>
          )}
          {target != null && (
            <p className="mt-4 border-t pt-3 text-sm text-muted-foreground">
              Goal target <span className="font-semibold text-foreground">{target} kg</span>
            </p>
          )}
        </div>
        {points.length >= 2 ? (
          <LazyWeightTrend points={points} target={target} />
        ) : (
          <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-8 text-center">
            <p className="max-w-sm text-sm text-muted-foreground">
              {points.length === 1
                ? 'Add another measurement on a different day to see your trend.'
                : latest
                  ? 'No measurements in the last 30 days. Record today’s weight to restart your trend.'
                  : 'Record your first weight to start tracking your progress.'}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
