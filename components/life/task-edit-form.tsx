'use client';

import { useState } from 'react';
import type { tasks } from '@/lib/db/schema';
import { editTaskAction } from '@/lib/actions/life-actions';
import { ActionForm } from './action-form';
import { AreaField } from './area-field';
import { TaskRepeatField } from './task-repeat-field';

export function TaskEditForm({
  task,
  areas,
  area,
  projects,
  goals,
}: {
  task: typeof tasks.$inferSelect;
  areas: string[];
  area: string;
  projects: { id: string; name: string }[];
  goals: { id: string; title: string }[];
}) {
  const [mounted, setMounted] = useState(false);
  return (
    <details
      className="group min-w-0 open:col-span-2"
      onToggle={(event) => {
        if (event.target === event.currentTarget && event.currentTarget.open) setMounted(true);
      }}
    >
      <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-lg bg-primary/5 px-3 text-sm font-medium text-primary hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
        Edit task
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          className="size-4 transition-transform group-open:rotate-180"
        >
          <path
            d="m5 7.5 5 5 5-5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </summary>
      {mounted && (
        <ActionForm
          action={editTaskAction}
          submitLabel="Save task"
          showSuccess={false}
          successConfirmation="Saved"
          className="mt-3 grid gap-4 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2 [&>div]:col-span-full [&>[role=alert]]:col-span-full"
        >
          <input type="hidden" name="id" value={task.id} />
          <input type="hidden" name="estimatedMinutes" value={task.estimatedMinutes ?? ''} />
          <label className="text-sm font-medium">
            Title
            <input
              name="title"
              defaultValue={task.title}
              required
              maxLength={160}
              className="mt-1.5 min-h-11 w-full rounded-lg border bg-background px-3 font-normal"
            />
          </label>
          <AreaField label="Area" options={areas} defaultValue={area} />
          <label className="text-sm font-medium sm:col-span-2">
            Details
            <textarea
              name="details"
              defaultValue={task.details ?? ''}
              maxLength={4000}
              className="mt-1.5 min-h-24 w-full rounded-lg border bg-background p-3 font-normal"
            />
          </label>
          <label className="text-sm font-medium">
            Project
            <select
              name="projectId"
              defaultValue={task.projectId ?? ''}
              className="mt-1.5 min-h-11 w-full rounded-lg border bg-background px-3 font-normal"
            >
              <option value="">None</option>
              {projects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Goal
            <select
              name="goalId"
              defaultValue={task.goalId ?? ''}
              className="mt-1.5 min-h-11 w-full rounded-lg border bg-background px-3 font-normal"
            >
              <option value="">None</option>
              {goals.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Priority
            <select
              name="priority"
              defaultValue={task.priority}
              className="mt-1.5 min-h-11 w-full rounded-lg border bg-background px-3 font-normal"
            >
              <option value="1">High</option>
              <option value="2">Medium</option>
              <option value="3">Low</option>
            </select>
          </label>
          <label className="text-sm font-medium">
            Start date
            <input
              type="date"
              name="scheduledDate"
              defaultValue={task.scheduledDate ?? ''}
              className="mt-1.5 min-h-11 w-full rounded-lg border bg-background px-3 font-normal"
            />
          </label>
          <label className="text-sm font-medium">
            End date
            <input
              type="date"
              name="dueDate"
              defaultValue={task.dueDate ?? ''}
              className="mt-1.5 min-h-11 w-full rounded-lg border bg-background px-3 font-normal"
            />
          </label>
          <TaskRepeatField
            initial={task.recurrence}
            weekdays={task.weekdays}
            checklist={task.checklist}
            checklistResetDaily={task.checklistResetDaily}
          />
          <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
            <input type="checkbox" name="isMilestone" defaultChecked={task.isMilestone} /> Milestone
          </label>
        </ActionForm>
      )}
    </details>
  );
}
