import { z } from 'zod';

export const ChecklistItemSchema = z.object({
  id: z.uuid(),
  text: z.string().trim().min(1).max(160),
  done: z.boolean(),
});
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;

export function readChecklist(value: string | null): ChecklistItem[] {
  if (!value) return [];
  try {
    return z.array(ChecklistItemSchema).max(30).parse(JSON.parse(value));
  } catch {
    return [];
  }
}

export function checklistFromForm(
  enabled: boolean,
  raw: string,
  previous: ChecklistItem[] = [],
): { items: ChecklistItem[]; error?: string } {
  if (!enabled) return { items: [] };
  const titles = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!titles.length) return { items: [], error: 'Add at least one checklist item.' };
  if (titles.length > 30) return { items: [], error: 'Keep the checklist to 30 items or fewer.' };
  if (titles.some((title) => title.length > 160))
    return { items: [], error: 'Keep each checklist item to 160 characters or fewer.' };
  const used = new Set<string>();
  return {
    items: titles.map((title) => {
      const existing = previous.find((item) => item.text === title && !used.has(item.id));
      if (existing) used.add(existing.id);
      return existing ?? { id: crypto.randomUUID(), text: title, done: false };
    }),
  };
}

export function checklistActiveOn(
  task: { scheduledDate: string | null; dueDate: string | null; status: string },
  date: string,
) {
  return (
    task.status !== 'cancelled' &&
    Boolean(
      task.scheduledDate && date >= task.scheduledDate && (!task.dueDate || date <= task.dueDate),
    )
  );
}
