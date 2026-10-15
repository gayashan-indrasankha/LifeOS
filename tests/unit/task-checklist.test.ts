import { describe, expect, it } from 'vitest';
import {
  checklistActiveOn,
  checklistFromForm,
  checklistToForm,
  readChecklist,
} from '@/lib/planning/task-checklist';

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

  it('keeps topic progress when moving items into sections and editing them', () => {
    const original = checklistFromForm(true, 'Java basics\nSQL joins').items;
    original[0].done = true;
    const grouped = checklistFromForm(
      true,
      '# Java Fundamentals\n- Java basics\n# Databases\n- SQL joins',
      original,
    ).items;
    expect(grouped.map(({ text, section, done }) => ({ text, section, done }))).toEqual([
      { text: 'Java basics', section: 'Java Fundamentals', done: true },
      { text: 'SQL joins', section: 'Databases', done: false },
    ]);
    expect(checklistFromForm(true, checklistToForm(grouped), grouped).items).toEqual(grouped);
  });

  it('accepts a long grouped curriculum without truncating its items', () => {
    const input = `# Curriculum\n${Array.from({ length: 391 }, (_, index) => `- Topic ${index + 1}`).join('\n')}`;
    const result = checklistFromForm(true, input);
    expect(result.error).toBeUndefined();
    expect(readChecklist(JSON.stringify(result.items))).toHaveLength(391);
  });
});
