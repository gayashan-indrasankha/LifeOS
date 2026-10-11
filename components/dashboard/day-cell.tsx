'use client';

import { memo } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface DayCellProps {
  habitName: string;
  date: string;
  isCompleted: boolean;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  isEligible: boolean;
  isReadOnly?: boolean;
  isPending: boolean;
  isBusy: boolean;
  onToggle: (date: string) => void;
}

export const DayCell = memo(function DayCell({
  habitName,
  date,
  isCompleted,
  isToday,
  isPast,
  isFuture,
  isEligible,
  isReadOnly = false,
  isPending,
  isBusy,
  onToggle,
}: DayCellProps) {
  const label = isPast
    ? `${isCompleted ? 'Completed' : 'Not completed'} for ${habitName} on ${date} (past day locked)`
    : `${isCompleted ? 'Remove completion' : 'Mark complete'} for ${habitName} on ${date}`;
  return (
    <td
      className={cn(
        'habit-grid-day w-11 min-w-11 border-b p-0.5 text-center sm:w-10 sm:min-w-10 sm:p-1',
        isToday && 'sm:bg-primary/5',
      )}
    >
      {isEligible || isCompleted ? (
        <button
          type="button"
          aria-label={label}
          aria-pressed={isCompleted}
          title={label}
          disabled={isPast || isFuture || isBusy || isReadOnly}
          onClick={() => onToggle(date)}
          className={cn(
            'mx-auto flex h-10 w-10 items-center justify-center rounded-[5px] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:h-7 sm:w-7',
            isCompleted
              ? 'border-primary bg-primary text-primary-foreground shadow-sm'
              : 'border-border bg-background hover:border-primary hover:bg-primary/5',
            (isFuture || isPast) && 'cursor-not-allowed',
            isFuture && 'opacity-35',
            isPast && !isCompleted && 'opacity-55',
            isPending && 'opacity-65',
          )}
        >
          {isPending ? (
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          ) : isCompleted ? (
            <Check aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
          ) : null}
        </button>
      ) : (
        <span
          aria-label="Not scheduled"
          className="mx-auto block text-sm font-medium text-muted-foreground/60"
        >
          —
        </span>
      )}
    </td>
  );
});
