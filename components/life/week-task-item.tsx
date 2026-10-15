'use client';

import { useId, useState } from 'react';
import { CalendarDays, CheckCircle2, ChevronDown, Circle } from 'lucide-react';
import { ActionForm } from '@/components/life/action-form';
import { toggleTaskOccurrenceAction, updateTaskAction } from '@/lib/actions/life-actions';
import { TaskChecklist } from '@/components/life/task-checklist';

export function WeekTaskItem({
  task,
  date,
  weekStart,
  weekEnd,
  today,
  dailyDoneIds,
}: {
  task: {
    id: string;
    title: string;
    area: string;
    status: string;
    recurrence: string;
    checklist: string | null;
    checklistResetDaily: boolean;
    scheduledDate: string | null;
    dueDate: string | null;
  };
  date: string;
  weekStart: string;
  weekEnd?: string;
  today: string;
  dailyDoneIds: string[];
}) {
  const [editingDay, setEditingDay] = useState(false);
  const editorId = useId();
  const done = task.status === 'done';
  const recurring = task.recurrence && task.recurrence !== 'once';

  return (
    <li
      className={`overflow-hidden rounded-xl border transition-colors ${done ? 'bg-muted/25' : 'bg-background hover:border-primary/25'}`}
    >
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4">
        <div className="flex min-w-0 items-start gap-3">
          {done ? (
            <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
          ) : (
            <Circle
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-muted-foreground/50"
            />
          )}
          <div className="min-w-0">
            <p
              className={`break-words text-sm font-semibold leading-snug ${done ? 'text-muted-foreground' : 'text-foreground'}`}
            >
              {task.title}
            </p>
            {(task.area !== 'Personal Development' || done) && (
              <p className="mt-1 text-xs text-muted-foreground">
                {task.area !== 'Personal Development' ? task.area : ''}
                {done ? `${task.area !== 'Personal Development' ? ' · ' : ''}Done` : ''}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2 self-end sm:self-auto">
          {!recurring && (
            <button
              type="button"
              aria-expanded={editingDay}
              aria-controls={editorId}
              onClick={() => setEditingDay((current) => !current)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <CalendarDays aria-hidden="true" className="size-4" />
              Change day
              <ChevronDown
                aria-hidden="true"
                className={`size-4 transition-transform ${editingDay ? 'rotate-180' : ''}`}
              />
            </button>
          )}
          <ActionForm
            action={recurring ? toggleTaskOccurrenceAction : updateTaskAction}
            submitLabel={done ? 'Reopen' : 'Mark done'}
            buttonVariant="secondary"
            showSuccess={false}
            className="[&>button]:min-h-10"
          >
            <input type="hidden" name="id" value={task.id} />
            {recurring ? (
              <>
                <input type="hidden" name="date" value={date} />
                <input type="hidden" name="completed" value={done ? 'no' : 'yes'} />
              </>
            ) : (
              <input type="hidden" name="status" value={done ? 'todo' : 'done'} />
            )}
          </ActionForm>
        </div>
      </div>
      {task.checklist && (
        <div className="border-t px-3 pb-3 sm:px-4">
          <TaskChecklist task={task} today={today} date={date} dailyDoneIds={dailyDoneIds} />
        </div>
      )}
      {!recurring && editingDay && (
        <div id={editorId} className="border-t bg-muted/20 px-3 py-3 sm:px-4">
          <ActionForm
            action={updateTaskAction}
            submitLabel="Save day"
            showSuccess={false}
            className="flex flex-wrap items-end gap-3 [&>button]:min-h-11"
          >
            <input type="hidden" name="id" value={task.id} />
            <input type="hidden" name="status" value={task.status} />
            <label className="min-w-44 flex-1 text-xs font-medium sm:max-w-56">
              New day
              <input
                type="date"
                name="scheduledDate"
                required
                min={weekStart}
                max={weekEnd}
                defaultValue={date}
                className="mt-1.5 min-h-11 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
              />
            </label>
          </ActionForm>
        </div>
      )}
    </li>
  );
}
