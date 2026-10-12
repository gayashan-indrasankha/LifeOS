import { describe, expect, it } from 'vitest';
import { calculateTopHabits } from '@/lib/analytics/top-habits';
import type { SelectHabit, SelectHabitEntry } from '@/types';

const rule = {
  effectiveDate: '2026-10-09',
  schedule: 'daily',
  startDate: '2026-10-08',
  endDate: null,
  status: 'active',
};

function habit(id: string, name: string): SelectHabit {
  return {
    id,
    name,
    schedule: 'daily',
    startDate: '2026-10-08',
    endDate: null,
    scheduleRevisions: [rule],
  } as SelectHabit;
}

function completion(habitId: string): SelectHabitEntry {
  return { habitId, date: '2026-10-08', completed: true } as SelectHabitEntry;
}

describe('top fixed-schedule habits', () => {
  it('credits a recorded check-in before the first known schedule without inventing missed days', () => {
    const ranked = calculateTopHabits(
      [habit('gym', 'Hit the gym'), habit('eat', 'eat')],
      [completion('gym'), completion('eat')],
      [new Date(2026, 9, 8), new Date(2026, 9, 9)],
      new Date(2026, 9, 9),
      1,
    );
    expect(ranked).toMatchObject([
      {
        habit: { name: 'eat' },
        completed: 1,
        total: 2,
        rate: 50,
      },
    ]);
  });
});
