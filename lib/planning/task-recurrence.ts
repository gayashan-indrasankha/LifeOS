import type { tasks } from '@/lib/db/schema';
import { addCalendarDays } from '@/lib/planning/time-blocks';

export type Task = typeof tasks.$inferSelect;
export type TaskOccurrence = Task & { occurrenceDate?: string };

export function occursOn(task: Task, date: string): boolean {
  if (task.recurrence === 'once') return task.scheduledDate === date;
  if (!task.scheduledDate || !task.dueDate || date < task.scheduledDate || date > task.dueDate)
    return false;
  if (task.recurrence === 'daily') return true;
  if (task.recurrence !== 'weekly' || !task.weekdays) return false;
  const weekday = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
  return task.weekdays[weekday] === '1';
}

export function taskOccurrences(
  source: Task[],
  start: string,
  end: string,
  completed: ReadonlySet<string>,
): TaskOccurrence[] {
  const occurrences: TaskOccurrence[] = [];
  for (const task of source) {
    if (task.status === 'cancelled') continue;
    if (task.recurrence === 'once') {
      if (task.scheduledDate && task.scheduledDate >= start && task.scheduledDate <= end)
        occurrences.push(task);
      continue;
    }
    for (let date = start; date <= end; date = addCalendarDays(date, 1)) {
      if (occursOn(task, date)) {
        occurrences.push({
          ...task,
          scheduledDate: date,
          occurrenceDate: date,
          dailyPriority: null,
          status: completed.has(`${task.id}:${date}`) ? 'done' : 'todo',
        });
      }
    }
  }
  return occurrences;
}
