'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { prevMonth, nextMonth, formatMonthLabel, currentYearMonth } from '@/lib/utils/date';
import { useCallback } from 'react';

interface MonthNavigatorProps {
  currentMonth: string; // YYYY-MM
  timezone?: string;
}

export function MonthNavigator({ currentMonth, timezone = 'UTC' }: MonthNavigatorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const navigate = useCallback(
    (month: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('month', month);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  const todayMonth = currentYearMonth(timezone);
  const isCurrentMonth = currentMonth === todayMonth;

  return (
    <div className="flex w-full min-w-0 items-center justify-between gap-1 sm:w-auto sm:justify-start sm:gap-1.5">
      <Button
        variant="outline"
        size="icon"
        className="h-11 w-11 shrink-0 sm:h-10 sm:w-10"
        onClick={() => navigate(prevMonth(currentMonth))}
        aria-label="Previous month"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="min-w-0 flex-1 whitespace-nowrap text-center sm:min-w-[180px] sm:flex-none">
        <span aria-live="polite" className="text-sm font-semibold sm:text-lg">
          {formatMonthLabel(currentMonth)}
        </span>
      </div>

      <Button
        variant="outline"
        size="icon"
        className="h-11 w-11 shrink-0 sm:h-10 sm:w-10"
        onClick={() => navigate(nextMonth(currentMonth))}
        aria-label="Next month"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(todayMonth)}
        disabled={isCurrentMonth}
        className="min-h-11 shrink-0 gap-1 px-1.5 text-muted-foreground sm:min-h-10 sm:px-2"
        aria-label="Current month"
      >
        <CalendarDays className="h-3.5 w-3.5" />
        <span className="sm:hidden">Today</span>
        <span className="hidden sm:inline">Current month</span>
      </Button>
    </div>
  );
}
