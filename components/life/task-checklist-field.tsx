'use client';

import { useState } from 'react';
import { readChecklist } from '@/lib/planning/task-checklist';

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
          One item per line. Progress carries forward from the task&apos;s start date through its
          end date.
          <textarea
            name="checklistItems"
            required
            rows={5}
            maxLength={5000}
            defaultValue={items.map((item) => item.text).join('\n')}
            placeholder="Programming and OOP&#10;Data structures and algorithms&#10;SQL and databases"
            className="mt-2 w-full rounded-lg border bg-background p-3 text-foreground"
          />
        </label>
      )}
    </div>
  );
}
