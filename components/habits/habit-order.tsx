'use client';

import { useState, useTransition } from 'react';
import { ArrowDown, ArrowUp, ListOrdered } from 'lucide-react';
import type { SelectHabit } from '@/types';
import { reorderHabitsAction } from '@/lib/actions/habit-actions';
import { HabitCard } from './habit-card';

export function HabitOrder({ habits }: { habits: SelectHabit[] }) {
  const [items, setItems] = useState(habits);
  const [isReordering, setIsReordering] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const [previousHabits, setPreviousHabits] = useState(habits);
  if (habits !== previousHabits) {
    setPreviousHabits(habits);
    if (!pending) setItems(habits);
  }
  function move(index: number, offset: number) {
    if (pending || index + offset < 0 || index + offset >= items.length) return;
    const previous = items;
    const next = [...items];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    setItems(next);
    setError('');
    start(async () => {
      try {
        const result = await reorderHabitsAction(next.map((item) => item.id));
        if (result.error) throw new Error(result.error);
      } catch {
        setItems(previous);
        setError('Could not save the new order. Try again.');
      }
    });
  }
  return (
    <div className="space-y-4">
      {items.length > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Your habits</h2>
          <button
            type="button"
            aria-expanded={isReordering}
            aria-controls="active-habit-list"
            onClick={() => setIsReordering((value) => !value)}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border bg-card px-3 text-sm font-medium text-primary hover:bg-muted"
          >
            <ListOrdered className="h-4 w-4" aria-hidden="true" />
            {isReordering ? 'Done arranging' : 'Change order'}
          </button>
        </div>
      )}
      {isReordering && (
        <p className="text-sm text-muted-foreground">
          Move a habit up or down to change the order you see it in.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <ol id="active-habit-list" className="space-y-2">
        {items.map((habit, index) => (
          <li key={habit.id}>
            <HabitCard habit={habit} />
            {isReordering && (
              <div className="mt-2 flex flex-wrap gap-2 pl-1">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={pending || index === 0}
                  aria-label={`Move ${habit.name} up`}
                  className="inline-flex min-h-10 items-center gap-1 rounded-lg border bg-card px-3 text-sm disabled:opacity-40"
                >
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                  Move up
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={pending || index === items.length - 1}
                  aria-label={`Move ${habit.name} down`}
                  className="inline-flex min-h-10 items-center gap-1 rounded-lg border bg-card px-3 text-sm disabled:opacity-40"
                >
                  <ArrowDown className="h-4 w-4" aria-hidden="true" />
                  Move down
                </button>
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
