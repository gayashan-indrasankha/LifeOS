import Link from 'next/link';
import { LazyWeightTrend } from './lazy-weight-trend';

export function GoalWeightTrend({
  points,
  target,
}: {
  points: { date: string; value: number }[];
  target: number | null;
}) {
  if (!points.length) {
    return (
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/15 bg-primary/5 p-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background text-primary">
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="size-5">
              <path
                d="M2.5 15.5h15M4 12l3-3 2.5 2 4.5-5 1.5 1.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-foreground">Body-weight trend</span>
            <span className="block text-xs text-muted-foreground">No measurements yet</span>
          </span>
        </div>
        <Link
          href="/today#today-weight"
          className="inline-flex min-h-9 items-center justify-center rounded-lg border border-primary/20 bg-background px-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          Record weight
        </Link>
      </div>
    );
  }

  return (
    <details className="group/weight mt-4 overflow-hidden rounded-xl border bg-muted/20">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
        <span>Body-weight trend</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open/weight:rotate-180"
        >
          <path
            d="m5 7.5 5 5 5-5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </summary>
      <div className="border-t bg-background p-3">
        <LazyWeightTrend points={points} target={target} />
        <Link
          href="/dashboard#home-weight"
          className="mt-2 inline-flex min-h-9 items-center rounded-lg px-2 text-sm font-medium text-primary hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          View weight progress
        </Link>
      </div>
    </details>
  );
}
