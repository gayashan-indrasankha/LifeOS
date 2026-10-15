'use client';

import { useState } from 'react';
import { checklistToForm, readChecklist } from '@/lib/planning/task-checklist';

export function TaskChecklistField({ initial = null }: { initial?: string | null }) {
  const items = readChecklist(initial);
  const [enabled, setEnabled] = useState(items.length > 0);
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
        <label className="block text-muted-foreground">
          Add a heading with <code># Section name</code>, then one item per line. Progress carries
          forward from the task&apos;s start date through its end date.
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
      )}
    </div>
  );
}
