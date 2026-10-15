import { describe, expect, it } from 'vitest';
import { checklistActiveOn, checklistFromForm, readChecklist } from '@/lib/planning/task-checklist';

describe('task checklist', () => {
  it('keeps completed items when the checklist is edited and adds new items unchecked', () => {
    const initial = checklistFromForm(true, 'Programming\nSQL').items;
    initial[0].done = true;
    const edited = checklistFromForm(true, 'SQL\nProgramming\nTesting', initial).items;
    expect(edited.map((item) => [item.text, item.done])).toEqual([
      ['SQL', false],
      ['Programming', true],
      ['Testing', false],
    ]);
    expect(readChecklist(JSON.stringify(edited))).toEqual(edited);
  });

  it('only permits marking items from start through end, inclusive', () => {
    const task = { scheduledDate: '2026-10-15', dueDate: '2027-04-15', status: 'todo' };
    expect(checklistActiveOn(task, '2026-10-14')).toBe(false);
    expect(checklistActiveOn(task, '2026-10-15')).toBe(true);
    expect(checklistActiveOn(task, '2027-04-15')).toBe(true);
    expect(checklistActiveOn(task, '2027-04-16')).toBe(false);
  });
});
