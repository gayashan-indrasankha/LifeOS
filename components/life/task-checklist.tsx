'use client';

import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { ActionForm } from '@/components/life/action-form';
import { toggleTaskChecklistItemAction } from '@/lib/actions/life-actions';
import {
  checklistActiveOn,
  readChecklist,
  type ChecklistItem,
} from '@/lib/planning/task-checklist';

function ChecklistItems({
  items,
  active,
  taskId,
  completedIds,
}: {
  items: ChecklistItem[];
  active: boolean;
  taskId: string;
  completedIds: Set<string>;
}) {
  return (
    <ul className="mt-2 space-y-1">
      {items.map((item) => {
        const done = completedIds.has(item.id);
        return (
          <li key={item.id}>
            {active ? (
              <ActionForm
                action={toggleTaskChecklistItemAction}
                submitLabel={done ? '✓' : '○'}
                submitAriaLabel={`${done ? 'Reopen' : 'Complete'} ${item.text}`}
                pendingSpinner
                showSuccess={false}
                buttonVariant="secondary"
                className="flex items-center gap-2 [&>button]:order-first [&>button]:size-8 [&>button]:shrink-0 [&>button]:rounded-full [&>button]:p-0 [&>[role=alert]]:basis-full"
              >
                <input type="hidden" name="taskId" value={taskId} />
                <input type="hidden" name="itemId" value={item.id} />
                <input type="hidden" name="done" value={done ? 'no' : 'yes'} />
                <span className={`text-sm ${done ? 'text-muted-foreground line-through' : ''}`}>
                  {item.text}
                </span>
              </ActionForm>
            ) : (
              <p className="py-1 text-sm text-muted-foreground">
                {done ? '✓' : '○'} {item.text}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ChecklistSection({
  section,
  items,
  active,
  taskId,
  completedIds,
}: {
  section: string;
  items: ChecklistItem[];
  active: boolean;
  taskId: string;
  completedIds: Set<string>;
}) {
  const [mounted, setMounted] = useState(false);
  return (
    <details
      className="group/section mt-2 rounded-lg border bg-muted/20 px-3 py-2"
      onToggle={(event) => {
        if (event.target === event.currentTarget && event.currentTarget.open) setMounted(true);
      }}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <span className="flex-1">{section}</span>
        <span className="tabular-nums text-muted-foreground">
          {`${items.filter((item) => completedIds.has(item.id)).length}/${items.length}`}
        </span>
        <ChevronDown
          aria-hidden="true"
          className="size-4 shrink-0 transition-transform group-open/section:rotate-180"
        />
      </summary>
      {mounted && (
        <ChecklistItems items={items} active={active} taskId={taskId} completedIds={completedIds} />
      )}
    </details>
  );
}

export function TaskChecklist({
  task,
  today,
  date = today,
  dailyDoneIds = [],
}: {
  task: {
    id: string;
    checklist: string | null;
    checklistResetDaily: boolean;
    recurrence: string;
    scheduledDate: string | null;
    dueDate: string | null;
    status: string;
  };
  today: string;
  date?: string;
  dailyDoneIds?: string[];
}) {
  const [mounted, setMounted] = useState(false);
  const items = useMemo(() => readChecklist(task.checklist), [task.checklist]);
  if (!items.length) return null;
  const resetDaily = task.checklistResetDaily && task.recurrence === 'daily';
  const completedIds = new Set(
    resetDaily ? dailyDoneIds : items.filter((item) => item.done).map((item) => item.id),
  );
  const done = items.filter((item) => completedIds.has(item.id)).length;
  const percentage = Math.round((done / items.length) * 1000) / 10;
  const active = checklistActiveOn(task, today) && (!resetDaily || date === today);
  const groups = new Map<string, ChecklistItem[]>();
  for (const item of items) {
    const section = item.section ?? '';
    const group = groups.get(section) ?? [];
    group.push(item);
    groups.set(section, group);
  }
  return (
    <details
      className="group mt-4 rounded-xl border bg-background p-3"
      onToggle={(event) => {
        if (event.target === event.currentTarget && event.currentTarget.open) setMounted(true);
      }}
    >
      <summary className="cursor-pointer list-none rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex-1">{resetDaily ? 'Daily checklist' : 'Preparation progress'}</span>
          <span className="shrink-0 whitespace-nowrap tabular-nums">
            {done}/{items.length}
            <span className="ml-1 text-xs text-muted-foreground">({percentage}%)</span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className="size-4 shrink-0 transition-transform group-open:rotate-180"
          />
        </span>
        <span
          role="progressbar"
          aria-label="Checklist progress"
          aria-valuemin={0}
          aria-valuemax={items.length}
          aria-valuenow={done}
          aria-valuetext={`${percentage}% complete`}
          className="mt-2 block h-2 overflow-hidden rounded-full bg-muted"
        >
          <span
            className="block h-full rounded-full bg-primary"
            style={{ width: `${(done / items.length) * 100}%` }}
          />
        </span>
      </summary>
      {mounted &&
        [...groups].map(([section, sectionItems]) =>
          section ? (
            <ChecklistSection
              key={section}
              section={section}
              items={sectionItems}
              active={active}
              taskId={task.id}
              completedIds={completedIds}
            />
          ) : (
            <ChecklistItems
              key="ungrouped"
              items={sectionItems}
              active={active}
              taskId={task.id}
              completedIds={completedIds}
            />
          ),
        )}
      {mounted && !active && (
        <p className="mt-2 text-xs text-muted-foreground">
          {resetDaily && date !== today
            ? 'Past and future daily checklists are read-only.'
            : `Available from ${task.scheduledDate} through ${task.dueDate}.`}
        </p>
      )}
    </details>
  );
}
