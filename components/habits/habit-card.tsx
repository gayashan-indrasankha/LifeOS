'use client';

import { useState, useTransition } from 'react';
import type { SelectHabit } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, Archive, ArchiveRestore, Loader2, Trash2 } from 'lucide-react';
import Link from 'next/link';
import {
  archiveHabitAction,
  deleteHabitAction,
  unarchiveHabitAction,
} from '@/lib/actions/habit-actions';

interface HabitCardProps {
  habit: SelectHabit;
  isArchived?: boolean;
}

function scheduleLabel(schedule: string) {
  if (schedule === 'daily') return 'Every day';
  if (schedule === 'weekdays') return 'Weekdays';
  if (schedule === 'weekends') return 'Weekends';
  if (schedule.startsWith('weekly:')) {
    const count = Number(schedule.slice(7));
    return `${count} ${count === 1 ? 'time' : 'times'} per week`;
  }
  if (/^custom:[01]{7}$/.test(schedule)) {
    const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return weekdays.filter((_, index) => schedule[7 + index] === '1').join(', ');
  }
  return schedule;
}

export function HabitCard({ habit, isArchived = false }: HabitCardProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  function handleArchive() {
    setError('');
    startTransition(async () => {
      try {
        const result = isArchived
          ? await unarchiveHabitAction(habit.id)
          : await archiveHabitAction(habit.id);
        if (result.error) setError(result.error);
      } catch {
        setError('Could not change this habit. Try again.');
      }
    });
  }

  function handleDelete() {
    setError('');
    startTransition(async () => {
      try {
        const result = await deleteHabitAction(habit.id);
        if (result.error) setError(result.error);
      } catch {
        setError('Could not delete this habit. Try again.');
      }
    });
  }

  return (
    <Card className="rounded-2xl shadow-none transition-colors hover:border-primary/30">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl font-semibold text-primary"
            aria-hidden="true"
          >
            {habit.icon || habit.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="break-words font-semibold leading-snug">{habit.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
              {habit.category && <span>{habit.category}</span>}
              {habit.category && <span aria-hidden="true">·</span>}
              <span>{scheduleLabel(habit.schedule)}</span>
              <span aria-hidden="true">·</span>
              <span>
                Goal: {habit.monthlyTarget} {habit.monthlyTarget === 1 ? 'day' : 'days'}/month
              </span>
            </div>
            {habit.description && (
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{habit.description}</p>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 text-primary"
                aria-label={`Actions for ${habit.name}`}
                disabled={isPending}
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/habits/${habit.id}/edit`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleArchive}
                className={
                  isArchived ? 'text-emerald-600 focus:text-emerald-600' : 'text-muted-foreground'
                }
              >
                {isArchived ? (
                  <>
                    <ArchiveRestore className="mr-2 h-4 w-4" />
                    Unarchive
                  </>
                ) : (
                  <>
                    <Archive className="mr-2 h-4 w-4" />
                    Archive
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={handleDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete habit
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {error && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
