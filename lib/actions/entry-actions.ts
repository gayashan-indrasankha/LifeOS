'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth/session';
import { ToggleEntrySchema } from '@/lib/validations/entry';
import { upsertHabitEntry, deleteHabitEntry } from '@/lib/dal/habit-entries';
import { getHabitByIdAndUser } from '@/lib/dal/habits';
import { getUserSettings } from '@/lib/dal/user-settings';
import { getTodayInTimezone, toDateString } from '@/lib/utils/date';
import { isGridApplicable } from '@/lib/analytics/habit-month-progress';

export type ToggleEntryState = {
  error?: string;
  success?: boolean;
};

export async function toggleEntryAction(
  _prevState: ToggleEntryState,
  formData: FormData,
): Promise<ToggleEntryState> {
  // 1. Authenticate
  const user = await getCurrentUser();
  if (!user) {
    return { error: 'Unauthorized' };
  }
  const userId = user.id;

  // 2. Parse & validate
  const raw = {
    habitId: formData.get('habitId'),
    date: formData.get('date'),
    completed:
      formData.get('completed') === 'true'
        ? true
        : formData.get('completed') === 'false'
          ? false
          : null,
  };
  const parsed = ToggleEntrySchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { habitId, date, completed } = parsed.data;

  // 3. Verify the habit belongs to this user (authorization)
  const [habit, settings] = await Promise.all([
    getHabitByIdAndUser(habitId, userId),
    getUserSettings(userId),
  ]);
  if (!habit || habit.archived) {
    return { error: 'Habit not found' };
  }

  const today = toDateString(getTodayInTimezone(settings.timezone));
  if (date < today) {
    return { error: 'Past days are locked. Only today’s habits can be changed.' };
  }
  const [year, month, day] = date.split('-').map(Number);
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  if (
    date > today ||
    !isGridApplicable(habit, { date, day: day, weekday: '', dayOfWeek }, [], new Set())
  ) {
    return { error: 'This date is not available for this habit' };
  }

  // 4. Perform the operation
  try {
    if (completed) {
      await upsertHabitEntry(userId, habitId, date, true);
    } else {
      await deleteHabitEntry(userId, habitId, date);
    }
  } catch {
    return { error: 'Could not save this day. Please try again.' };
  }

  revalidatePath('/dashboard');
  revalidatePath('/today');
  revalidatePath('/review');
  return { success: true };
}
