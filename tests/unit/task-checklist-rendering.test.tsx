import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TaskChecklist } from '@/components/life/task-checklist';
import { TaskEditForm } from '@/components/life/task-edit-form';
import type { tasks } from '@/lib/db/schema';

vi.mock('@/lib/actions/life-actions', () => ({
  toggleTaskChecklistItemAction: vi.fn(async () => ({ success: 'Checklist updated.' })),
  editTaskAction: vi.fn(async () => ({ success: 'Task edited.' })),
}));
afterEach(cleanup);

const items = Array.from({ length: 617 }, (_, index) => ({
  id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  text: `Practice item ${index + 1}`,
  section: index < 2 ? 'First section' : 'Other section',
  done: false,
}));
const task = {
  id: '00000000-0000-4000-8000-000000009999',
  title: 'Preparation',
  checklist: JSON.stringify(items),
  checklistResetDaily: true,
  recurrence: 'daily',
  scheduledDate: '2026-10-01',
  dueDate: '2027-04-01',
  status: 'todo',
  area: 'Personal Development',
  priority: 2,
  estimatedMinutes: null,
  details: 'Draft details',
  goalId: null,
  projectId: null,
  weekdays: null,
  isMilestone: false,
} as typeof tasks.$inferSelect;

function toggle(details: HTMLDetailsElement, open: boolean) {
  act(() => {
    details.open = open;
    fireEvent(details, new Event('toggle'));
  });
}

describe('large checklist rendering', () => {
  it('keeps all progress but mounts only checklist sections the user opens', () => {
    const view = render(<TaskChecklist task={task} today="2026-10-16" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '617');
    expect(view.container.querySelectorAll('form')).toHaveLength(0);
    const outer = view.container.querySelector('details')!;
    toggle(outer, true);
    expect(view.container.querySelectorAll('form')).toHaveLength(0);
    const first = screen.getByText('First section').closest('details')!;
    toggle(first, true);
    expect(view.container.querySelectorAll('form')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Complete Practice item 1' })).toBeVisible();
    expect(screen.queryByText('Practice item 617')).toBeNull();
    toggle(first, false);
    toggle(first, true);
    expect(view.container.querySelectorAll('form')).toHaveLength(2);
  });

  it('reconciles server updates and preserves read-only past daily checklists', () => {
    const view = render(
      <TaskChecklist task={task} today="2026-10-16" dailyDoneIds={[items[0].id]} />,
    );
    const outer = view.container.querySelector('details')!;
    toggle(outer, true);
    toggle(screen.getByText('First section').closest('details')!, true);
    expect(screen.getByRole('button', { name: 'Reopen Practice item 1' })).toBeVisible();
    view.rerender(<TaskChecklist task={task} today="2026-10-16" dailyDoneIds={[]} />);
    expect(screen.getByRole('button', { name: 'Complete Practice item 1' })).toBeVisible();
    view.rerender(
      <TaskChecklist
        task={task}
        today="2026-10-16"
        date="2026-10-15"
        dailyDoneIds={[items[0].id]}
      />,
    );
    expect(within(outer).queryByRole('button')).toBeNull();
    expect(screen.getByText('Past and future daily checklists are read-only.')).toBeVisible();
  });

  it('opens the existing editor on demand and retains unsaved edits when closed', () => {
    const view = render(
      <TaskEditForm task={task} area={task.area} areas={[task.area]} projects={[]} goals={[]} />,
    );
    expect(view.container.querySelectorAll('form')).toHaveLength(0);
    const details = view.container.querySelector('details')!;
    toggle(details, true);
    const title = screen.getByLabelText('Title');
    fireEvent.change(title, { target: { value: 'An unsaved title' } });
    toggle(details, false);
    toggle(details, true);
    expect(screen.getByLabelText('Title')).toHaveValue('An unsaved title');
    expect(screen.getByRole('button', { name: 'Save task' })).toBeVisible();
  });
});
