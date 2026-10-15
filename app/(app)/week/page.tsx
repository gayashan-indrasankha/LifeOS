import Link from 'next/link';
import { ArrowLeft, ArrowRight, ChevronDown } from 'lucide-react';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { getUserSettings } from '@/lib/dal/user-settings';
import { getTasks, getTaskCompletionKeys } from '@/lib/dal/life';
import { taskOccurrences } from '@/lib/planning/task-recurrence';
import { getTodayInTimezone, toDateString } from '@/lib/utils/date';
import { weekStart } from '@/lib/analytics/habit-month-progress';
import { addCalendarDays } from '@/lib/planning/time-blocks';
import { createTaskAction, planUnscheduledTaskAction } from '@/lib/actions/life-actions';
import { ActionForm } from '@/components/life/action-form';
import { TaskSearchSelect } from '@/components/life/task-search-select';
import { WeekTaskItem } from '@/components/life/week-task-item';

export const metadata = { title: 'Week | LifeOS' };

export default async function WeekPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await requireUser();
  const settings = await getUserSettings(user.id);
  const today = toDateString(getTodayInTimezone(settings.timezone));
  const requested = (await searchParams).date;
  const focused = requested && z.iso.date().safeParse(requested).success ? requested : today;
  const start = weekStart(focused, settings.weekStartsOn);
  const end = addCalendarDays(start, 6);
  const dates = Array.from({ length: 7 }, (_, i) => addCalendarDays(start, i));
  const tasks = await getTasks(user.id);
  const completed = await getTaskCompletionKeys(user.id, start, end);
  const weekTasks = taskOccurrences(tasks, start, end, completed, settings.timezone).filter(
    (task) =>
      task.scheduledDate &&
      task.scheduledDate >= start &&
      task.scheduledDate <= end &&
      task.status !== 'cancelled',
  );
  const completedTasks = weekTasks.filter((task) => task.status === 'done').length;
  const isCurrentWeek = start === weekStart(today, settings.weekStartsOn);
  const unplannedTasks = tasks.filter(
    (task) =>
      task.recurrence === 'once' &&
      !task.scheduledDate &&
      ['todo', 'in_progress'].includes(task.status),
  );
  const dateLabel = (date: string) =>
    new Intl.DateTimeFormat('en', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${date}T12:00:00Z`));
  const fullDateLabel = (date: string) =>
    new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${date}T12:00:00Z`));
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Your week</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {fullDateLabel(start)} – {fullDateLabel(end)}
          </p>
        </div>
        <nav
          aria-label="Weeks"
          className="android-week-nav grid grid-cols-3 gap-2 text-sm sm:flex sm:flex-wrap"
        >
          <Link
            href={`/week?date=${addCalendarDays(start, -7)}`}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border bg-card px-3 py-2 font-medium transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <ArrowLeft aria-hidden="true" className="hidden size-4 sm:block" />
            Previous week
          </Link>
          <Link
            href="/week"
            aria-current={isCurrentWeek ? 'page' : undefined}
            className={`inline-flex min-h-10 items-center justify-center rounded-xl border px-3 py-2 font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${isCurrentWeek ? 'border-primary/25 bg-primary/10 text-primary' : 'bg-card hover:border-primary/40 hover:bg-primary/5'}`}
          >
            This week
          </Link>
          <Link
            href={`/week?date=${addCalendarDays(start, 7)}`}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border bg-card px-3 py-2 font-medium transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Next week
            <ArrowRight aria-hidden="true" className="hidden size-4 sm:block" />
          </Link>
        </nav>
      </header>
      <section className="rounded-2xl border bg-card shadow-sm">
        <div className="rounded-t-2xl border-b bg-primary/5 px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Start with your tasks</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Pick a day for each task, then do it whenever it suits you. No time slots needed.
              </p>
            </div>
            <p className="rounded-full border border-primary/15 bg-card px-3 py-1.5 text-sm font-semibold text-primary">
              {weekTasks.length
                ? `${completedTasks} of ${weekTasks.length} done`
                : 'No tasks planned yet'}
            </p>
          </div>
          {weekTasks.length > 0 && (
            <div
              role="progressbar"
              aria-label="Weekly tasks completed"
              aria-valuemin={0}
              aria-valuemax={weekTasks.length}
              aria-valuenow={completedTasks}
              className="mt-5 h-1.5 overflow-hidden rounded-full bg-primary/10"
            >
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${(completedTasks / weekTasks.length) * 100}%` }}
              />
            </div>
          )}
        </div>
        <div className="space-y-4 p-4 sm:p-6">
          <div>
            <h3 className="text-sm font-semibold">Add a task</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Choose a day in this week.</p>
            <ActionForm
              key={`new-task-${weekTasks.length}`}
              action={createTaskAction}
              submitLabel="Add task"
              showSuccess={false}
              className="mt-3 grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto] [&>button[type=submit]]:min-h-11 [&>button[type=submit]]:w-full sm:[&>button[type=submit]]:w-auto [&>[role=alert]]:col-span-full [&>[role=status]]:col-span-full"
            >
              <input type="hidden" name="area" value="Personal Development" />
              <input type="hidden" name="priority" value="2" />
              <label className="min-w-0 text-sm font-medium">
                Task
                <input
                  name="title"
                  required
                  maxLength={160}
                  placeholder="What do you want to do?"
                  className="mt-1.5 min-h-11 w-full rounded-xl border bg-background px-3 outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                />
              </label>
              <label className="min-w-0 text-sm font-medium">
                Day
                <input
                  type="date"
                  name="scheduledDate"
                  required
                  min={start}
                  max={end}
                  defaultValue={focused}
                  className="mt-1.5 min-h-11 w-full rounded-xl border bg-background px-3 outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                />
              </label>
            </ActionForm>
          </div>
          {unplannedTasks.length > 0 && (
            <details
              key={`unplanned-${unplannedTasks.length}`}
              className="group rounded-xl border bg-muted/20 open:bg-background"
            >
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-primary hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
                <span>Plan an existing task ({unplannedTasks.length})</span>
                <ChevronDown
                  aria-hidden="true"
                  className="size-4 shrink-0 transition-transform group-open:rotate-180"
                />
              </summary>
              <div className="border-t px-4 pb-4 pt-1">
                <ActionForm
                  action={planUnscheduledTaskAction}
                  submitLabel="Add to week"
                  showSuccess={false}
                  className="mt-3 grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto] [&>button[type=submit]]:min-h-11 [&>button[type=submit]]:w-full sm:[&>button[type=submit]]:w-auto [&>[role=alert]]:col-span-full [&>[role=status]]:col-span-full"
                >
                  <TaskSearchSelect
                    tasks={unplannedTasks.map((task) => ({ id: task.id, title: task.title }))}
                  />
                  <label className="min-w-0 text-sm font-medium">
                    Day
                    <input
                      type="date"
                      name="date"
                      required
                      min={start}
                      max={end}
                      defaultValue={focused}
                      className="mt-1.5 min-h-11 w-full rounded-xl border bg-background px-3 outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                    />
                  </label>
                </ActionForm>
              </div>
            </details>
          )}
        </div>
      </section>
      <section aria-label="Tasks by day" className="space-y-3">
        {dates.map((date) => {
          const dayTasks = weekTasks
            .filter((task) => task.scheduledDate === date)
            .sort((a, b) => {
              if (a.status === 'done' && b.status !== 'done') return 1;
              if (b.status === 'done' && a.status !== 'done') return -1;
              return (a.dailyPriority ?? 9) - (b.dailyPriority ?? 9);
            });
          const dayDone = dayTasks.filter((task) => task.status === 'done').length;
          return (
            <div
              key={date}
              className={`rounded-2xl border bg-card p-4 sm:p-5 ${date === today ? 'border-primary/40 ring-1 ring-primary/10' : ''}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-bold tracking-tight">
                  {dateLabel(date)}
                  {date === today && (
                    <span className="ml-2 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                      Today
                    </span>
                  )}
                </h2>
                {dayTasks.length > 0 && (
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    {dayDone} of {dayTasks.length} done
                  </span>
                )}
              </div>
              {dayTasks.length > 0 && (
                <div
                  role="progressbar"
                  aria-label={`${dateLabel(date)} tasks completed`}
                  aria-valuemin={0}
                  aria-valuemax={dayTasks.length}
                  aria-valuenow={dayDone}
                  className="mt-3 h-1 overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(dayDone / dayTasks.length) * 100}%` }}
                  />
                </div>
              )}
              {dayTasks.length ? (
                <ul className="mt-4 space-y-2">
                  {dayTasks.map((task) => (
                    <WeekTaskItem
                      key={task.id}
                      task={{
                        id: task.id,
                        title: task.title,
                        area: task.area,
                        status: task.status,
                        checklist: task.checklist,
                        scheduledDate:
                          tasks.find((item) => item.id === task.id)?.scheduledDate ?? null,
                        dueDate: task.dueDate,
                        recurrence: task.recurrence,
                      }}
                      date={date}
                      weekStart={start}
                      today={today}
                      weekEnd={end}
                    />
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">Nothing planned.</p>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
