import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';
import { getGoals, getMetrics, getProjects, getTasks, getTaskCompletionKeys } from '@/lib/dal/life';
import { getUserSettings } from '@/lib/dal/user-settings';
import { getTodayInTimezone, toDateString } from '@/lib/utils/date';
import {
  createGoalAction,
  createTaskAction,
  editTaskAction,
  updateTaskAction,
  toggleTaskOccurrenceAction,
} from '@/lib/actions/life-actions';
import { ActionForm } from '@/components/life/action-form';
import { DeleteTaskButton } from '@/components/life/delete-task-button';
import { DeleteGoalButton } from '@/components/life/delete-goal-button';
import { AreaField } from '@/components/life/area-field';
import { EditGoalForm } from '@/components/life/entity-edit-forms';
import { setGoalArchiveAction } from '@/lib/actions/life-actions';
import { GoalWeightTrend } from '@/components/life/goal-weight-trend';
import { ProjectsTab } from '@/components/life/projects-tab';
import { TaskRepeatField } from '@/components/life/task-repeat-field';
import { occursOn as taskOccursOn } from '@/lib/planning/task-recurrence';
import { weightTrend } from '@/lib/evidence/summary';
import { LIFE_AREAS, normalizeLifeArea } from '@/lib/life-areas';

export const metadata = { title: 'Goals & Projects | LifeOS' };

const areas: readonly string[] = LIFE_AREAS;

export default async function GoalsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; show?: string }>;
}) {
  const params = await searchParams;
  const requestedView = params.view;
  const view = ['goals', 'projects'].includes(requestedView ?? '') ? requestedView : 'tasks';
  const userId = (await requireUser()).id;
  const [goals, projects, tasks, metrics, settings] = await Promise.all([
    getGoals(userId),
    getProjects(userId),
    getTasks(userId),
    getMetrics(userId),
    getUserSettings(userId),
  ]);
  const today = toDateString(getTodayInTimezone(settings.timezone));
  const completedToday = await getTaskCompletionKeys(userId, today, today);
  const activeTasks = tasks.filter((task) => !['done', 'cancelled'].includes(task.status));
  const inactiveTasks = tasks.filter((task) => ['done', 'cancelled'].includes(task.status));
  const activeGoals = goals.filter((goal) => !goal.archivedAt);
  const archivedGoals = goals.filter((goal) => goal.archivedAt);
  const latestWeight = metrics.find(
    (metric) => metric.type === 'Body weight' && metric.unit === 'kg',
  );
  const weightPoints = weightTrend(
    metrics
      .filter((metric) => metric.type === 'Body weight' && metric.unit === 'kg')
      .map((metric) => ({ date: metric.date, value: metric.value })),
    settings.weekStartsOn,
    null,
  ).daily;
  const savedAreas = [
    ...new Set(
      [...goals.map((goal) => goal.area), ...tasks.map((task) => task.area)].map(normalizeLifeArea),
    ),
  ]
    .filter((area) => area && !areas.includes(area))
    .sort((first, second) => first.localeCompare(second));
  const availableAreas = [...areas, ...savedAreas];
  const goalGroups = availableAreas
    .map((area) => ({
      area,
      goals: activeGoals.filter((goal) => normalizeLifeArea(goal.area) === area),
    }))
    .filter((group) => group.goals.length > 0);
  const taskGroups = availableAreas
    .map((area) => ({
      area,
      tasks: activeTasks.filter((task) => normalizeLifeArea(task.area) === area),
    }))
    .filter((group) => group.tasks.length > 0);
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Goals & projects</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Keep your tasks, goals, and projects together. Start with a task; connect it to a bigger
          goal whenever you are ready.
        </p>
      </header>
      <nav aria-label="Goals and projects sections" className="grid grid-cols-3 gap-2">
        {[
          { label: 'Tasks', href: '/goals', value: 'tasks' },
          { label: 'Goals', href: '/goals?view=goals', value: 'goals' },
          { label: 'Projects', href: '/goals?view=projects', value: 'projects' },
        ].map((item) => (
          <Link
            key={item.value}
            href={item.href}
            aria-current={view === item.value ? 'page' : undefined}
            className={`rounded-xl border px-3 py-3 text-center text-sm font-semibold transition-colors ${view === item.value ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {view === 'goals' && (
        <section className="rounded-2xl border bg-card p-5 sm:p-6">
          <h2 className="sr-only">Goals</h2>
          <details className="group/addgoal mb-7">
            <summary className="flex cursor-pointer list-none flex-col gap-4 rounded-2xl border border-primary/15 bg-primary/5 p-4 transition-colors hover:border-primary/30 hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:flex-row sm:items-center sm:justify-between sm:p-5 [&::-webkit-details-marker]:hidden">
              <span className="flex min-w-0 items-start gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-5">
                    <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
                    <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
                    <circle cx="12" cy="12" r="1" fill="currentColor" />
                  </svg>
                </span>
                <span className="min-w-0">
                  <span className="block text-xl font-bold leading-tight text-foreground">
                    Goals
                  </span>
                  <span className="mt-1.5 block max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    A goal is a result you want to reach. Add one when you know what you are working
                    toward.
                  </span>
                </span>
              </span>
              <span className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm sm:self-center">
                <span aria-hidden="true" className="text-lg leading-none group-open/addgoal:hidden">
                  +
                </span>
                <span className="group-open/addgoal:hidden">Add a goal</span>
                <span className="hidden group-open/addgoal:inline">Close form</span>
              </span>
            </summary>
            <ActionForm
              action={createGoalAction}
              submitLabel="Create goal"
              showSuccess={false}
              successConfirmation="Goal created"
              className="mt-4 grid gap-4 rounded-xl border bg-muted/20 p-4 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] sm:p-5 [&>button]:justify-self-end sm:[&>button]:col-start-2"
            >
              <label className="text-sm font-medium">
                Goal title
                <input
                  name="title"
                  required
                  maxLength={160}
                  placeholder="What do you want to achieve?"
                  className="mt-1.5 min-h-11 w-full rounded-lg border bg-background px-3 font-normal"
                />
              </label>
              <AreaField label="Life area" options={availableAreas} />
              <label className="text-sm font-medium sm:col-span-2">
                Description
                <textarea
                  name="description"
                  maxLength={2000}
                  className="mt-1.5 min-h-24 w-full rounded-lg border bg-background p-3 font-normal"
                />
              </label>
              <label className="text-sm font-medium">
                Target date
                <input
                  type="date"
                  name="targetDate"
                  className="mt-1.5 min-h-11 w-full rounded-lg border bg-background px-3 font-normal"
                />
              </label>
              <label className="text-sm font-medium">
                Priority
                <select
                  name="priority"
                  defaultValue="2"
                  className="mt-1.5 min-h-11 w-full rounded-lg border bg-background px-3 font-normal"
                >
                  <option value="1">High</option>
                  <option value="2">Medium</option>
                  <option value="3">Low</option>
                </select>
              </label>
              <label className="text-sm font-medium">
                Measurable target
                <input
                  type="number"
                  step="any"
                  min="0"
                  name="targetValue"
                  className="mt-1.5 min-h-11 w-full rounded-lg border bg-background px-3 font-normal"
                />
              </label>
              <label className="text-sm font-medium">
                Unit
                <input
                  name="targetUnit"
                  maxLength={32}
                  placeholder="kg, books, applications"
                  className="mt-1.5 min-h-11 w-full rounded-lg border bg-background px-3 font-normal"
                />
              </label>
            </ActionForm>
          </details>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold">Your goals</h3>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium tabular-nums text-muted-foreground">
              {activeGoals.length} active
            </span>
          </div>
          <div className="space-y-5">
            {goalGroups.map((group) => (
              <section
                key={group.area}
                aria-label={`${group.area} goals`}
                className="rounded-2xl border bg-muted/20 p-3 sm:p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-3 px-1">
                  <h4 className="text-base font-semibold text-foreground">{group.area}</h4>
                  <span className="rounded-full border bg-card px-2.5 py-1 text-xs font-medium tabular-nums text-muted-foreground">
                    {group.goals.length} {group.goals.length === 1 ? 'goal' : 'goals'}
                  </span>
                </div>
                <ul className="grid items-start gap-3 lg:grid-cols-2">
                  {group.goals.map((goal) => (
                    <li key={goal.id} className="min-w-0 rounded-xl border bg-card p-4 shadow-sm">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
                          {group.area}
                        </span>
                        <span className="rounded-full bg-muted px-2.5 py-1 font-medium capitalize text-muted-foreground">
                          {goal.status}
                        </span>
                      </div>
                      <h5 className="mt-3 text-base font-semibold leading-snug text-foreground">
                        {goal.title}
                      </h5>
                      {goal.description && (
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                          {goal.description}
                        </p>
                      )}
                      {(goal.targetDate || goal.targetValue != null) && (
                        <p className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {goal.targetDate && (
                            <span className="rounded-lg bg-muted/70 px-2.5 py-1.5">
                              Target date: {goal.targetDate}
                            </span>
                          )}
                          {goal.targetValue != null && (
                            <span className="rounded-lg bg-muted/70 px-2.5 py-1.5">
                              Target: {goal.targetValue} {goal.targetUnit ?? ''}
                            </span>
                          )}
                        </p>
                      )}
                      <div className="pt-4">
                        <p className="text-xs text-muted-foreground">
                          <strong className="font-semibold text-foreground">
                            {
                              tasks.filter(
                                (task) => task.goalId === goal.id && task.status === 'done',
                              ).length
                            }
                          </strong>{' '}
                          related tasks finished
                          {goal.targetUnit === 'kg' && latestWeight
                            ? ` · Latest recorded weight ${latestWeight.value} kg`
                            : ''}
                        </p>
                        {group.area === 'Fitness' && goal.targetUnit === 'kg' && (
                          <GoalWeightTrend points={weightPoints} target={goal.targetValue} />
                        )}
                        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 border-t pt-3">
                          <div className="flex min-w-0 flex-wrap items-start gap-2">
                            <EditGoalForm goal={goal} areas={availableAreas} />
                          </div>
                          <DeleteGoalButton id={goal.id} title={goal.title} />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {!activeGoals.length && (
              <p className="rounded-xl border border-dashed bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
                {goals.length
                  ? 'No active goals. Add a goal or restore one from the archive.'
                  : 'No goals yet. Start with one meaningful outcome.'}
              </p>
            )}
          </div>
          {archivedGoals.length > 0 && (
            <details className="group/archive mt-6 overflow-hidden rounded-xl border">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 bg-muted/30 px-4 text-sm font-semibold text-foreground hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
                <span>Archived goals</span>
                <span className="flex items-center gap-2 text-muted-foreground">
                  {archivedGoals.length}
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    fill="none"
                    className="size-4 transition-transform group-open/archive:rotate-180"
                  >
                    <path
                      d="m5 7.5 5 5 5-5"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </summary>
              <ul className="divide-y border-t">
                {archivedGoals.map((goal) => (
                  <li
                    key={goal.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm"
                  >
                    <strong>{goal.title}</strong>
                    <p className="text-muted-foreground">
                      {normalizeLifeArea(goal.area)} · {goal.status}
                    </p>
                    <ActionForm action={setGoalArchiveAction} submitLabel="Restore goal">
                      <input type="hidden" name="id" value={goal.id} />
                      <input type="hidden" name="archive" value="no" />
                    </ActionForm>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}
      {view === 'projects' && <ProjectsTab projects={projects} goals={goals} tasks={tasks} />}
      {view === 'tasks' && (
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="sr-only">Tasks</h2>
          <details className="group/addtask mb-6">
            <summary className="flex cursor-pointer list-none flex-col gap-5 rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 via-primary/5 to-background p-4 transition-colors hover:border-primary/30 hover:from-primary/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:flex-row sm:items-center sm:justify-between sm:p-5 [&::-webkit-details-marker]:hidden">
              <span className="flex min-w-0 items-start gap-4">
                <span
                  aria-hidden="true"
                  className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="size-5">
                    <path
                      d="M8 7h11M8 12h11M8 17h7M4.5 7h.01M4.5 12h.01M4.5 17h.01"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                <span className="min-w-0">
                  <span className="block text-xl font-bold leading-tight text-foreground">
                    Tasks
                  </span>
                  <span className="mt-1.5 block max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    Add the things you want to do. Choose up to three to focus on each day in Today.
                  </span>
                </span>
              </span>
              <span className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity group-hover/addtask:opacity-90 sm:self-center">
                <span aria-hidden="true" className="text-lg leading-none group-open/addtask:hidden">
                  +
                </span>
                <span className="group-open/addtask:hidden">Add a task</span>
                <span className="hidden group-open/addtask:inline">Close form</span>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="none"
                  className="hidden size-4 group-open/addtask:block"
                >
                  <path
                    d="m5 12.5 5-5 5 5"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </summary>
            <ActionForm
              action={createTaskAction}
              submitLabel="Add task"
              showSuccess={false}
              successConfirmation="Task added"
              className="mt-4 grid gap-4 rounded-xl border bg-muted/20 p-4 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] sm:p-5"
            >
              <label className="text-sm font-medium">
                Task title
                <input
                  name="title"
                  required
                  maxLength={160}
                  placeholder="What do you want to get done?"
                  className="mt-1.5 min-h-11 w-full rounded-lg border bg-background px-3 font-normal"
                />
              </label>
              <AreaField label="Area" options={availableAreas} />
              <div className="border-t pt-4 sm:col-span-2">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-medium sm:col-span-2">
                    Details
                    <textarea
                      name="details"
                      maxLength={4000}
                      className="mt-1.5 min-h-24 w-full rounded-lg border bg-background p-3 font-normal"
                    />
                  </label>
                  <label className="text-sm font-medium">
                    Project
                    <select
                      name="projectId"
                      className="mt-1.5 min-h-11 w-full rounded-lg border bg-background px-3 font-normal"
                    >
                      <option value="">None</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-medium">
                    Goal
                    <select
                      name="goalId"
                      className="mt-1.5 min-h-11 w-full rounded-lg border bg-background px-3 font-normal"
                    >
                      <option value="">None</option>
                      {goals.map((goal) => (
                        <option key={goal.id} value={goal.id}>
                          {goal.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-medium">
                    Priority
                    <select
                      name="priority"
                      defaultValue="2"
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
                      defaultValue={today}
                      className="mt-1.5 min-h-11 w-full rounded-lg border bg-background px-3 font-normal"
                    />
                  </label>
                  <label className="text-sm font-medium">
                    End date
                    <input
                      type="date"
                      name="dueDate"
                      className="mt-1.5 min-h-11 w-full rounded-lg border bg-background px-3 font-normal"
                    />
                  </label>
                  <TaskRepeatField />
                  <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
                    <input type="checkbox" name="isMilestone" /> Project milestone
                  </label>
                </div>
              </div>
            </ActionForm>
          </details>
          <div className="space-y-5">
            {taskGroups.map((group) => (
              <section
                key={group.area}
                aria-label={`${group.area} tasks`}
                className="rounded-2xl border bg-muted/20 p-3 sm:p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-3 px-1">
                  <h3 className="text-base font-semibold text-foreground">{group.area}</h3>
                  <span className="rounded-full border bg-card px-2.5 py-1 text-xs font-medium tabular-nums text-muted-foreground">
                    {group.tasks.length} {group.tasks.length === 1 ? 'task' : 'tasks'}
                  </span>
                </div>
                <ul className="grid items-start gap-3 lg:grid-cols-2">
                  {group.tasks.map((task) => (
                    <li
                      id={`task-${task.id}`}
                      key={task.id}
                      className="scroll-mt-32 rounded-xl border bg-card p-4 shadow-sm lg:scroll-mt-20"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-1.5 text-xs">
                            <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
                              {group.area}
                            </span>
                            {task.projectId && (
                              <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                                {projects.find((project) => project.id === task.projectId)?.name ??
                                  'Project'}
                              </span>
                            )}
                            {task.isMilestone && (
                              <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                                Milestone
                              </span>
                            )}
                          </div>
                          <h4 className="text-base font-semibold leading-snug text-foreground">
                            {task.title}
                          </h4>
                          <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span>
                              {task.recurrence !== 'once' &&
                              completedToday.has(`${task.id}:${today}`)
                                ? 'Done today'
                                : task.status === 'in_progress'
                                  ? 'In progress'
                                  : 'To do'}
                            </span>
                            {task.scheduledDate && <span>Start {task.scheduledDate}</span>}
                            {task.dueDate && <span>End {task.dueDate}</span>}
                            {task.recurrence !== 'once' && (
                              <span>
                                {task.recurrence === 'daily' ? 'Every day' : 'Selected weekdays'}
                              </span>
                            )}
                          </p>
                        </div>
                        {(task.recurrence === 'once' || taskOccursOn(task, today)) && (
                          <ActionForm
                            action={
                              task.recurrence === 'once'
                                ? updateTaskAction
                                : toggleTaskOccurrenceAction
                            }
                            submitLabel={
                              task.recurrence === 'once'
                                ? 'Mark done'
                                : completedToday.has(`${task.id}:${today}`)
                                  ? 'Reopen today'
                                  : 'Mark today done'
                            }
                            className="shrink-0 self-start"
                            showSuccess={false}
                          >
                            <input type="hidden" name="id" value={task.id} />
                            {task.recurrence === 'once' ? (
                              <input type="hidden" name="status" value="done" />
                            ) : (
                              <>
                                <input type="hidden" name="date" value={today} />
                                <input
                                  type="hidden"
                                  name="completed"
                                  value={completedToday.has(`${task.id}:${today}`) ? 'no' : 'yes'}
                                />
                              </>
                            )}
                          </ActionForm>
                        )}
                      </div>
                      <div className="mt-4 grid grid-cols-[1fr_auto] items-start gap-2 border-t pt-3">
                        <details className="group min-w-0 open:col-span-2">
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
                          <ActionForm
                            action={editTaskAction}
                            submitLabel="Save task"
                            showSuccess={false}
                            successConfirmation="Saved"
                            className="mt-3 grid gap-4 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2 [&>div]:col-span-full [&>[role=alert]]:col-span-full"
                          >
                            <input type="hidden" name="id" value={task.id} />
                            <input
                              type="hidden"
                              name="estimatedMinutes"
                              value={task.estimatedMinutes ?? ''}
                            />
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
                            <AreaField
                              label="Area"
                              options={availableAreas}
                              defaultValue={group.area}
                            />
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
                            <TaskRepeatField initial={task.recurrence} weekdays={task.weekdays} />
                            <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
                              <input
                                type="checkbox"
                                name="isMilestone"
                                defaultChecked={task.isMilestone}
                              />{' '}
                              Milestone
                            </label>
                          </ActionForm>
                        </details>
                        <DeleteTaskButton id={task.id} title={task.title} />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {!activeTasks.length && (
              <p className="rounded-xl border border-dashed bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
                Your tasks will appear here.
              </p>
            )}
          </div>
          {inactiveTasks.length > 0 && (
            <details
              className="group/finished mt-6 overflow-hidden rounded-2xl border bg-card"
              open={params.show === 'finished'}
            >
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:px-5 [&::-webkit-details-marker]:hidden">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-5">
                      <path
                        d="m5 12 4 4L19 6"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span className="min-w-0 text-left">
                    <span className="block text-sm font-semibold text-foreground sm:text-base">
                      Finished
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Review tasks and reopen them when needed
                    </span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold tabular-nums text-muted-foreground">
                    {inactiveTasks.length}
                  </span>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    fill="none"
                    className="size-4 text-muted-foreground transition-transform group-open/finished:rotate-180"
                  >
                    <path
                      d="m5 7.5 5 5 5-5"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </summary>
              <ul className="divide-y border-t">
                {inactiveTasks.map((task) => (
                  <li
                    id={`task-${task.id}`}
                    key={task.id}
                    className="scroll-mt-32 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-5 lg:scroll-mt-20"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span
                        aria-hidden="true"
                        className={`flex size-8 shrink-0 items-center justify-center rounded-full ${task.status === 'done' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground'}`}
                      >
                        {task.status === 'done' ? (
                          <svg viewBox="0 0 20 20" fill="none" className="size-4">
                            <path
                              d="m4.5 10 3.5 3.5L15.5 6"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 20 20" fill="none" className="size-4">
                            <path
                              d="m6 6 8 8m0-8-8 8"
                              stroke="currentColor"
                              strokeWidth="1.75"
                              strokeLinecap="round"
                            />
                          </svg>
                        )}
                      </span>
                      <div className="min-w-0">
                        <h3 className="break-words text-sm font-semibold leading-snug text-foreground">
                          {task.title}
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {task.area} <span aria-hidden="true">·</span>{' '}
                          {task.status === 'done' ? 'Done' : 'Cancelled'}
                        </p>
                      </div>
                    </div>
                    <ActionForm
                      action={updateTaskAction}
                      submitLabel="Reopen"
                      showSuccess={false}
                      buttonVariant="secondary"
                      className="shrink-0"
                    >
                      <input type="hidden" name="id" value={task.id} />
                      <input type="hidden" name="status" value="todo" />
                    </ActionForm>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}
      <Link
        href="/goals/evidence"
        className="group flex min-h-20 items-center gap-4 rounded-2xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-5">
            <path
              d="M5 18V11m7 7V6m7 12v-9M3 20h18"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-foreground">Evidence & career readiness</span>
          <span className="mt-0.5 block text-sm text-muted-foreground">
            See your practice, project work, and applications
          </span>
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          className="size-5 shrink-0 text-primary transition-transform group-hover:translate-x-1"
        >
          <path
            d="M4 10h12m-5-5 5 5-5 5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Link>
    </div>
  );
}
