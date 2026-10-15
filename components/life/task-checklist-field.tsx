'use client';

import { useState } from 'react';
import { checklistToForm, readChecklist } from '@/lib/planning/task-checklist';

export function TaskChecklistField({
  initial = null,
  initialResetDaily = false,
  recurrence,
}: {
  initial?: string | null;
  initialResetDaily?: boolean;
  recurrence: string;
}) {
  const items = readChecklist(initial);
  const [enabled, setEnabled] = useState(items.length > 0);
  const [resetDaily, setResetDaily] = useState(initialResetDaily);
  return (
    <div className="space-y-2 rounded-lg border bg-background p-3 text-sm sm:col-span-2">
      <label className="flex min-h-8 items-center gap-2 font-medium">
        <input
          type="checkbox"
          name="checklistEnabled"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
        />
        Add a progress checklist
      </label>
      {enabled && (
        <>
          {recurrence === 'daily' && (
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2.5">
              <span>
                <span className="block font-medium text-foreground">Reset checklist every day</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  {resetDaily
                    ? 'On: each day starts unchecked; previous days stay saved.'
                    : 'Off: checked items carry forward until the task ends.'}
                </span>
              </span>
              <input
                type="checkbox"
                role="switch"
                name="checklistResetDaily"
                checked={resetDaily}
                onChange={(event) => setResetDaily(event.target.checked)}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className="h-6 w-11 shrink-0 rounded-full bg-muted-foreground/35 p-0.5 transition-colors after:block after:size-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-primary peer-checked:after:translate-x-5 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary"
              />
            </label>
          )}
          <label className="block text-muted-foreground">
            Add a heading with <code># Section name</code>, then one item per line.{' '}
            {recurrence === 'daily' && resetDaily
              ? 'Items reset for each day from the task start through its end date.'
              : "Progress carries forward from the task's start date through its end date."}
            <textarea
              name="checklistItems"
              required
              rows={10}
              maxLength={75000}
              defaultValue={checklistToForm(items)}
              placeholder={
                '# Programming and OOP\n- Java basics\n- Classes and objects\n# Databases\n- SQL joins'
              }
              className="mt-2 w-full rounded-lg border bg-background p-3 text-foreground"
            />
          </label>
        </>
      )}
    </div>
  );
}
