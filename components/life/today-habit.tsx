'use client';

import { useEffect, useState, useTransition } from 'react';
import { toggleEntryAction } from '@/lib/actions/entry-actions';
import type { RealtimeChange } from '@/components/providers/realtime-sync';

export function TodayHabit({
  id,
  name,
  date,
  completed,
  detail,
}: {
  id: string;
  name: string;
  date: string;
  completed: boolean;
  detail?: string;
}) {
  const [checked, setChecked] = useState(completed);
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  useEffect(() => {
    const onChange = (event: Event) => {
      const change = (event as CustomEvent<RealtimeChange>).detail;
      if (
        change.table === 'habit_entries' &&
        change.habitId === id &&
        change.date === date &&
        typeof change.completed === 'boolean'
      ) {
        setChecked(change.completed);
      }
    };
    window.addEventListener('lifeos:realtime-change', onChange);
    return () => window.removeEventListener('lifeos:realtime-change', onChange);
  }, [id, date]);
  return (
    <li className="rounded-xl border bg-card p-3">
      <label className="flex min-h-10 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          className="h-5 w-5 accent-primary"
          checked={checked}
          disabled={pending}
          onChange={() => {
            const next = !checked;
            setChecked(next);
            setError('');
            start(async () => {
              const data = new FormData();
              data.set('habitId', id);
              data.set('date', date);
              data.set('completed', String(next));
              try {
                const result = await toggleEntryAction({}, data);
                if (result.error) throw new Error(result.error);
              } catch {
                setChecked(!next);
                setError('Could not save. Try again.');
              }
            });
          }}
        />
        <span className="flex-1 text-sm font-medium">{name}</span>
        {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
      </label>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </li>
  );
}
