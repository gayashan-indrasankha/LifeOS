'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/session';
import { getUserSettings } from '@/lib/dal/user-settings';
import { getTodayInTimezone, toDateString } from '@/lib/utils/date';
import { HabitCreateSchema, HabitUpdateSchema } from '@/lib/validations/habit';
import {
  createHabit,
  updateHabit,
  archiveHabit,
  unarchiveHabit,
  deleteHabit,
  reorderHabits,
  getHabitByIdAndUser,
} from '@/lib/dal/habits';

export type HabitActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
};

async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user.id;
}

export async function createHabitAction(
  _prevState: HabitActionState,
  formData: FormData,
): Promise<HabitActionState> {
  let userId: string;
  try {
    userId = await requireAuth();
  } catch {
    return { error: 'Unauthorized' };
  }

  const raw = {
    name: formData.get('name'),
    description: formData.get('description') || undefined,
    icon: formData.get('icon') || undefined,
    category: formData.get('category') || undefined,
    monthlyTarget: Number(formData.get('monthlyTarget')),
    schedule: formData.get('schedule'),
    startDate: formData.get('startDate'),
    endDate: formData.get('endDate') || undefined,
  };

  const parsed = HabitCreateSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const [key, messages] of Object.entries(parsed.error.flatten().fieldErrors)) {
      fieldErrors[key] = messages ?? [];
    }
    return { fieldErrors };
  }

  await createHabit(userId, parsed.data);
  revalidatePath('/habits');
  revalidatePath('/dashboard');
  redirect('/habits');
}

export async function updateHabitAction(
  habitId: string,
  _prevState: HabitActionState,
  formData: FormData,
): Promise<HabitActionState> {
  let userId: string;
  try {
    userId = await requireAuth();
  } catch {
    return { error: 'Unauthorized' };
  }

  const raw = {
    name: formData.has('name') ? formData.get('name') : undefined,
    description: formData.has('description') ? formData.get('description') : undefined,
    icon: formData.has('icon') ? formData.get('icon') : undefined,
    category: formData.has('category') ? formData.get('category') : undefined,
    monthlyTarget: formData.get('monthlyTarget')
      ? Number(formData.get('monthlyTarget'))
      : undefined,
    schedule: formData.get('schedule') || undefined,
    startDate: formData.get('startDate') || undefined,
    endDate: formData.has('endDate') ? formData.get('endDate') : undefined,
  };

  const parsed = HabitUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const [key, messages] of Object.entries(parsed.error.flatten().fieldErrors)) {
      fieldErrors[key] = messages ?? [];
    }
    return { fieldErrors };
  }

  const existing = await getHabitByIdAndUser(habitId, userId);
  if (!existing) return { error: 'Habit not found' };
  const today = toDateString(getTodayInTimezone((await getUserSettings(userId)).timezone));
  const effectiveDate = formData.get('effectiveDate');
  if (
    typeof effectiveDate !== 'string' ||
    !z.iso.date().safeParse(effectiveDate).success ||
    effectiveDate < today
  )
    return { fieldErrors: { effectiveDate: ['Choose today or a future effective date.'] } };
  const nextStart = parsed.data.startDate ?? existing.startDate;
  const nextEnd = parsed.data.endDate === undefined ? existing.endDate : parsed.data.endDate;
  if (nextEnd && nextEnd < nextStart)
    return { fieldErrors: { endDate: ['End date must be on or after the start date'] } };
  const updated = await updateHabit(habitId, userId, parsed.data, effectiveDate);
  if (!updated) return { error: 'Habit not found' };

  revalidatePath('/habits');
  revalidatePath('/dashboard');
  redirect('/habits');
}

export async function archiveHabitAction(habitId: string): Promise<HabitActionState> {
  let userId: string;
  try {
    userId = await requireAuth();
  } catch {
    return { error: 'Unauthorized' };
  }

  const today = toDateString(getTodayInTimezone((await getUserSettings(userId)).timezone));
  const result = await archiveHabit(habitId, userId, today);
  if (!result) return { error: 'Habit not found' };

  revalidatePath('/habits');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function unarchiveHabitAction(habitId: string): Promise<HabitActionState> {
  let userId: string;
  try {
    userId = await requireAuth();
  } catch {
    return { error: 'Unauthorized' };
  }

  const today = toDateString(getTodayInTimezone((await getUserSettings(userId)).timezone));
  const result = await unarchiveHabit(habitId, userId, today);
  if (!result) return { error: 'Habit not found' };

  revalidatePath('/habits');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function deleteHabitAction(habitId: string): Promise<HabitActionState> {
  let userId: string;
  try {
    userId = await requireAuth();
  } catch {
    return { error: 'Unauthorized' };
  }
  if (!z.uuid().safeParse(habitId).success) return { error: 'Invalid habit.' };

  const deleted = await deleteHabit(habitId, userId);
  if (!deleted) return { error: 'Habit not found.' };

  for (const path of ['/habits', '/dashboard', '/today', '/review', '/settings/life-os'])
    revalidatePath(path);
  return { success: true };
}

export async function reorderHabitsAction(orderedIds: string[]): Promise<HabitActionState> {
  let userId: string;
  try {
    userId = await requireAuth();
  } catch {
    return { error: 'Unauthorized' };
  }

  if (!z.array(z.uuid()).max(500).safeParse(orderedIds).success)
    return { error: 'Invalid habit order.' };
  try {
    await reorderHabits(userId, orderedIds);
  } catch {
    return { error: 'Could not save the habit order. Refresh and try again.' };
  }
  revalidatePath('/habits');
  revalidatePath('/dashboard');
  return { success: true };
}
