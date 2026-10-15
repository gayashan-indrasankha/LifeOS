import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TaskRepeatField } from '@/components/life/task-repeat-field';

afterEach(cleanup);

describe('daily checklist reset switch', () => {
  it('appears only for a daily task with a checklist and starts off', () => {
    render(<TaskRepeatField initial="daily" />);
    expect(screen.queryByRole('switch')).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Add a progress checklist' }));
    const resetSwitch = screen.getByRole('switch', { name: /Reset checklist every day/ });
    expect((resetSwitch as HTMLInputElement).checked).toBe(false);
    fireEvent.click(resetSwitch);
    expect((resetSwitch as HTMLInputElement).checked).toBe(true);
    fireEvent.change(screen.getByRole('combobox', { name: 'Repeat' }), {
      target: { value: 'once' },
    });
    expect(screen.queryByRole('switch')).toBeNull();
  });
});
