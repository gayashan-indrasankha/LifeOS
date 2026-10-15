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
}: {
  items: ChecklistItem[];
  active: boolean;
  taskId: string;
}) {
  return (
    <ul className="mt-2 space-y-1">
      {items.map((item) => (
        <li key={item.id}>
          {active ? (
            <ActionForm
              action={toggleTaskChecklistItemAction}
              submitLabel={item.done ? '✓' : '○'}
              submitAriaLabel={`${item.done ? 'Reopen' : 'Complete'} ${item.text}`}
              pendingSpinner
              showSuccess={false}
              buttonVariant="secondary"
              className="flex items-center gap-2 [&>button]:order-first [&>button]:size-8 [&>button]:shrink-0 [&>button]:rounded-full [&>button]:p-0 [&>[role=alert]]:basis-full"
            >
              <input type="hidden" name="taskId" value={taskId} />
              <input type="hidden" name="itemId" value={item.id} />
              <input type="hidden" name="done" value={item.done ? 'no' : 'yes'} />
              <span className={`text-sm ${item.done ? 'text-muted-foreground line-through' : ''}`}>
                {item.text}
              </span>
            </ActionForm>
          ) : (
            <p className="py-1 text-sm text-muted-foreground">
              {item.done ? '✓' : '○'} {item.text}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

export function TaskChecklist({
  task,
  today,
}: {
  task: {
    id: string;
    checklist: string | null;
    scheduledDate: string | null;
    dueDate: string | null;
    status: string;
  };
  today: string;
}) {
  const items = readChecklist(task.checklist);
  if (!items.length) return null;
  const done = items.filter((item) => item.done).length;
  const percentage = Math.round((done / items.length) * 1000) / 10;
  const active = checklistActiveOn(task, today);
  const groups = new Map<string, ChecklistItem[]>();
  for (const item of items) {
    const section = item.section ?? '';
    const group = groups.get(section) ?? [];
    group.push(item);
    groups.set(section, group);
  }
  return (
    <details className="group mt-4 rounded-xl border bg-background p-3">
      <summary className="cursor-pointer list-none rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex-1">Preparation progress</span>
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
      {[...groups].map(([section, sectionItems]) =>
        section ? (
          <details
            key={section}
            className="group/section mt-2 rounded-lg border bg-muted/20 px-3 py-2"
          >
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
              <span className="flex-1">{section}</span>
              <span className="tabular-nums text-muted-foreground">
                {sectionItems.filter((item) => item.done).length}/{sectionItems.length}
              </span>
              <ChevronDown
                aria-hidden="true"
                className="size-4 shrink-0 transition-transform group-open/section:rotate-180"
              />
            </summary>
            <ChecklistItems items={sectionItems} active={active} taskId={task.id} />
          </details>
        ) : (
          <ChecklistItems key="ungrouped" items={sectionItems} active={active} taskId={task.id} />
        ),
      )}
      {!active && (
        <p className="mt-2 text-xs text-muted-foreground">
          Available from {task.scheduledDate} through {task.dueDate}.
        </p>
      )}
    </details>
  );
}
