import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { HabitRow } from '@/components/dashboard/habit-row';
import type { SelectHabit } from '@/types';

vi.mock('@/lib/actions/entry-actions', () => ({ toggleEntryAction: vi.fn() }));
const date = '2026-10-16';
const days = [{ date, day: 16, weekday: 'Fri', dayOfWeek: 5 }];
const habit = {
  id: 'habit-1',
  name: 'Read',
  schedule: 'daily',
  monthlyTarget: 20,
  startDate: '2026-10-01',
  endDate: null,
  archived: false,
} as SelectHabit;
afterEach(cleanup);

it('reconciles changed server values and realtime events after memoized refreshes', async () => {
  const row = (name: string, completed: string[]) => (
    <table>
      <tbody>
        <HabitRow
          habit={{ ...habit, name }}
          days={days.map((day) => ({ ...day }))}
          today={date}
          weekStartsOn={1}
          initialCompletedDates={completed}
        />
      </tbody>
    </table>
  );
  const view = render(row('Read', []));
  view.rerender(row('Read', []));
  expect(screen.getByRole('button', { name: /Mark complete for Read/ })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  view.rerender(row('Read a book', [date]));
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: /Remove completion for Read a book/ }),
    ).toHaveAttribute('aria-pressed', 'true'),
  );
  act(() => {
    window.dispatchEvent(
      new CustomEvent('lifeos:realtime-change', {
        detail: { table: 'habit_entries', habitId: habit.id, date, completed: false },
      }),
    );
  });
  expect(screen.getByRole('button', { name: /Mark complete for Read a book/ })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});
