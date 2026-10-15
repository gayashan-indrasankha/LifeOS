import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import type { tasks } from '@/lib/db/schema';
import { managePriorityAction, updateTaskAction } from '@/lib/actions/life-actions';
import { ActionForm } from './action-form';
import { PriorityPicker, type BacklogChoice } from './priority-picker';
import { focusedDayTasks } from '@/lib/planning/today-focus';
import { TaskChecklist } from './task-checklist';

type Task = typeof tasks.$inferSelect;

export function PriorityPanel({
  date,
  mode,
  selected,
  choices,
}: {
  date: string;
  mode: 'normal' | 'reduced' | 'minimum';
  selected: Task[];
  choices: BacklogChoice[];
}) {
  const slots = [1, 2, 3].map((rank) => selected.find((task) => task.dailyPriority === rank));
  const visibleIds = new Set(focusedDayTasks(selected, mode).map((task) => task.id));
  const otherTasks = selected.filter((task) => !visibleIds.has(task.id));
  return (
    <section className="rounded-2xl border bg-card p-4 sm:p-6">
      <div className="mb-5">
        <h2 className="text-xl font-bold tracking-tight">Focus tasks</h2>
        <p className="mt-1 text-sm text-muted-foreground">Your top tasks for today.</p>
      </div>
      {selected.length === 0 && (
        <p className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">
          No focus task yet. Add one below to give your day a clear starting point.
        </p>
      )}
      {selected.length > 0 && visibleIds.size === 0 && (
        <p className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">
          No focus tasks left to do. Your finished tasks are below.
        </p>
      )}
      <ol className="mt-3 space-y-3">
        {slots.map((task, index) => (
          <li
            key={index}
            hidden={!task || !visibleIds.has(task.id)}
            className={`rounded-2xl border p-4 sm:p-5 ${task?.status === 'done' ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20' : 'bg-card'}`}
          >
            {task ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-muted-foreground">
                        Task {index + 1}
                      </p>
                      <h3 className="mt-0.5 break-words text-base font-semibold leading-snug">
                        {task.title}
                      </h3>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                          {task.area}
                        </span>
                        {task.status !== 'todo' && (
                          <span
                            className={`rounded-full px-2.5 py-1 font-medium ${task.status === 'done' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200' : 'bg-primary/10 text-primary'}`}
                          >
                            {task.status === 'done' ? 'Completed' : 'In progress'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ActionForm
                    action={updateTaskAction}
                    submitLabel={task.status === 'done' ? 'Reopen' : 'Mark done'}
                    buttonVariant={task.status === 'done' ? 'secondary' : 'primary'}
                    showSuccess={false}
                    className="shrink-0"
                  >
                    <input type="hidden" name="id" value={task.id} />
                    <input
                      type="hidden"
                      name="status"
                      value={task.status === 'done' ? 'todo' : 'done'}
                    />
                  </ActionForm>
                </div>
                <TaskChecklist task={task} today={date} />
                <details className="group mt-4 border-t pt-3 text-sm">
                  <summary className="flex min-h-10 w-fit cursor-pointer list-none items-center gap-1.5 rounded-md py-1 font-medium text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
                    Task options
                    <ChevronDown
                      aria-hidden="true"
                      className="h-4 w-4 transition-transform group-open:rotate-180"
                    />
                  </summary>
                  <div
                    className={`mt-3 grid gap-3 border-t pt-4 ${selected.length > 1 ? 'sm:grid-cols-2' : ''}`}
                  >
                    {selected.length > 1 && (
                      <div className="rounded-xl bg-muted/40 p-4">
                        <p className="font-semibold">Priority order</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Swap this task with another focus task.
                        </p>
                        <ActionForm
                          action={managePriorityAction}
                          submitLabel="Swap tasks"
                          buttonVariant="secondary"
                          showSuccess={false}
                          className="mt-3 flex flex-wrap items-end gap-2"
                        >
                          <input type="hidden" name="id" value={task.id} />
                          <input type="hidden" name="date" value={date} />
                          <input type="hidden" name="operation" value="move" />
                          <label className="flex flex-col gap-1.5 text-xs font-medium">
                            Swap with
                            <select
                              name="rank"
                              defaultValue={
                                slots.findIndex((other) => other && other.id !== task.id) + 1
                              }
                              className="min-h-10 rounded-lg border bg-background px-3 text-sm"
                            >
                              {slots.map((other, otherIndex) =>
                                other && otherIndex !== index ? (
                                  <option key={other.id} value={otherIndex + 1}>
                                    Task {otherIndex + 1}
                                  </option>
                                ) : null,
                              )}
                            </select>
                          </label>
                        </ActionForm>
                      </div>
                    )}
                    <div className="rounded-xl bg-muted/40 p-4">
                      <p className="font-semibold">Move to another day</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Keep the task, but change its date.
                      </p>
                      <ActionForm
                        action={updateTaskAction}
                        submitLabel="Reschedule"
                        buttonVariant="secondary"
                        showSuccess={false}
                        className="mt-3 flex flex-wrap items-end gap-2"
                      >
                        <input type="hidden" name="id" value={task.id} />
                        <input type="hidden" name="status" value={task.status} />
                        <label className="flex flex-col gap-1.5 text-xs font-medium">
                          New date
                          <input
                            type="date"
                            name="scheduledDate"
                            required
                            defaultValue={date}
                            className="min-h-10 rounded-lg border bg-background px-3 text-sm"
                          />
                        </label>
                      </ActionForm>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-4">
                    <Link
                      href={`/goals${['done', 'cancelled'].includes(task.status) ? '?show=finished' : ''}#task-${task.id}`}
                      className="inline-flex min-h-10 items-center rounded-lg px-1 font-medium text-primary hover:underline"
                    >
                      {['done', 'cancelled'].includes(task.status) ? 'View task' : 'Edit task'}
                    </Link>
                    <ActionForm
                      action={managePriorityAction}
                      submitLabel="Remove priority"
                      buttonVariant="secondary"
                      showSuccess={false}
                    >
                      <input type="hidden" name="id" value={task.id} />
                      <input type="hidden" name="date" value={date} />
                      <input type="hidden" name="operation" value="remove" />
                    </ActionForm>
                  </div>
                </details>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Empty slot. Choose a task below.</p>
            )}
          </li>
        ))}
      </ol>
      {otherTasks.length > 0 && (
        <details className="mt-3 rounded-xl border p-3 text-sm">
          <summary className="min-h-10 cursor-pointer py-2 font-semibold text-primary">
            Other saved tasks
          </summary>
          <ol className="mt-2 space-y-2">
            {otherTasks.map((task) => (
              <li key={task.id} className="rounded-lg border p-2">
                <strong>{task.title}</strong> · {task.status.replace('_', ' ')} ·{' '}
                <Link
                  href={`/goals${['done', 'cancelled'].includes(task.status) ? '?show=finished' : ''}#task-${task.id}`}
                  className="text-primary underline"
                >
                  Open task
                </Link>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-muted-foreground">
            These tasks are still saved for today. Showing less does not complete or move them.
          </p>
        </details>
      )}
      {choices.length > 0 ? (
        <PriorityPicker
          date={date}
          choices={choices}
          occupied={slots.map((task) => task?.title ?? null)}
        />
      ) : (
        <Link
          href="/goals"
          className="android-primary-action mt-4 inline-block text-sm font-semibold text-primary underline"
        >
          {selected.length ? 'Manage all tasks' : 'Create your first task'}
        </Link>
      )}
    </section>
  );
}
