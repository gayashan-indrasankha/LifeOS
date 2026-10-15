import { z } from 'zod';

export const ChecklistItemSchema = z.object({
  id: z.uuid(),
  text: z.string().trim().min(1).max(160),
  done: z.boolean(),
  section: z.string().trim().min(1).max(100).optional(),
});
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;
const MAX_CHECKLIST_ITEMS = 750;

export function readChecklist(value: string | null): ChecklistItem[] {
  if (!value) return [];
  try {
    return z.array(ChecklistItemSchema).max(MAX_CHECKLIST_ITEMS).parse(JSON.parse(value));
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
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  let section: string | undefined;
  const entries: { text: string; section?: string }[] = [];
  for (const line of lines) {
    if (line.startsWith('# ')) {
      section = line.slice(2).trim();
      if (!section || section.length > 100)
        return { items: [], error: 'Keep section headings to 100 characters or fewer.' };
      continue;
    }
    entries.push({ text: line.replace(/^[-*] /, '').trim(), section });
  }
  if (!entries.length) return { items: [], error: 'Add at least one checklist item.' };
  if (entries.length > MAX_CHECKLIST_ITEMS)
    return { items: [], error: `Keep the checklist to ${MAX_CHECKLIST_ITEMS} items or fewer.` };
  if (entries.some(({ text }) => !text || text.length > 160))
    return { items: [], error: 'Keep each checklist item to 160 characters or fewer.' };
  const used = new Set<string>();
  return {
    items: entries.map(({ text, section }) => {
      const existing = previous.find((item) => item.text === text && !used.has(item.id));
      if (existing) used.add(existing.id);
      return {
        id: existing?.id ?? crypto.randomUUID(),
        text,
        done: existing?.done ?? false,
        ...(section ? { section } : {}),
      };
    }),
  };
}

export function checklistToForm(items: ChecklistItem[]): string {
  let section: string | undefined;
  return items
    .flatMap((item) => {
      const lines: string[] = [];
      if (item.section !== section) {
        section = item.section;
        if (section) lines.push(`# ${section}`);
      }
      lines.push(item.section ? `- ${item.text}` : item.text);
      return lines;
    })
    .join('\n');
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
