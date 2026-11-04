import Link from 'next/link';
import type { goals, projects, tasks } from '@/lib/db/schema';
import { createProjectAction, setProjectArchiveAction } from '@/lib/actions/life-actions';
import { ActionForm } from './action-form';
import { EditProjectForm } from './entity-edit-forms';

type Goal = typeof goals.$inferSelect;
type Project = typeof projects.$inferSelect;
type Task = typeof tasks.$inferSelect;

export function ProjectsTab({
  projects: allProjects,
  goals: availableGoals,
  tasks: allTasks,
}: {
  projects: Project[];
  goals: Goal[];
  tasks: Task[];
}) {
  const active = allProjects.filter((project) => !project.archivedAt);
  const archived = allProjects.filter((project) => project.archivedAt);

  return (
    <section className="rounded-2xl border bg-card p-5 sm:p-6">
      <h2 className="sr-only">Projects</h2>
      <details className="group/addproject mb-7">
        <summary className="flex cursor-pointer list-none flex-col gap-4 rounded-2xl border border-primary/15 bg-primary/5 p-4 transition-colors hover:border-primary/30 hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:flex-row sm:items-center sm:justify-between sm:p-5 [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 items-start gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-5">
                <path
                  d="M3.5 7.5V5.5h6l2 2h9v11h-17v-11Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="min-w-0">
              <span className="block text-xl font-bold leading-tight text-foreground">
                Projects
              </span>
              <span className="mt-1.5 block max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Keep the tasks for one piece of work together and see what to do next.
              </span>
            </span>
          </span>
          <span className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm sm:self-center">
            <span aria-hidden="true" className="text-lg leading-none group-open/addproject:hidden">
              +
            </span>
            <span className="group-open/addproject:hidden">Add a project</span>
            <span className="hidden group-open/addproject:inline">Close form</span>
          </span>
        </summary>
        <ActionForm
          action={createProjectAction}
          submitLabel="Create project"
          showSuccess={false}
          successConfirmation="Project created"
          className="mt-4 grid gap-4 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2 sm:p-5"
        >
          <label className="text-sm font-medium">
            Project name
            <input
              name="name"
              required
              maxLength={160}
              placeholder="What are you working on?"
              className="mt-1.5 min-h-11 w-full rounded-lg border bg-background px-3 font-normal"
            />
          </label>
          <label className="text-sm font-medium">
            Project type
            <select
              name="type"
              className="mt-1.5 min-h-11 w-full rounded-lg border bg-background px-3 font-normal"
            >
              <option>General</option>
              <option>UCSC Industry Project</option>
              <option>Software Engineering Portfolio</option>
              <option>AI Engineering Portfolio</option>
              <option>DevOps Portfolio</option>
            </select>
          </label>
          <label className="text-sm font-medium sm:col-span-2">
            Description
            <textarea
              name="description"
              maxLength={2000}
              placeholder="A short note about this project"
              className="mt-1.5 min-h-24 w-full rounded-lg border bg-background p-3 font-normal"
            />
          </label>
          <label className="text-sm font-medium">
            Related goal
            <select
              name="goalId"
              className="mt-1.5 min-h-11 w-full rounded-lg border bg-background px-3 font-normal"
            >
              <option value="">None</option>
              {availableGoals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.title}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Deadline
            <input
              type="date"
              name="deadline"
              className="mt-1.5 min-h-11 w-full rounded-lg border bg-background px-3 font-normal"
            />
          </label>
          <label className="text-sm font-medium sm:col-span-2">
            Repository URL
            <input
              type="url"
              name="repositoryUrl"
              placeholder="https://…"
              className="mt-1.5 min-h-11 w-full rounded-lg border bg-background px-3 font-normal"
            />
          </label>
        </ActionForm>
      </details>

      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">Your projects</h3>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium tabular-nums text-muted-foreground">
          {active.length} active
        </span>
      </div>
      <ul className="grid items-start gap-4 md:grid-cols-2">
        {active.map((project) => {
          const linked = allTasks.filter((task) => task.projectId === project.id);
          const milestones = linked.filter((task) => task.isMilestone);
          const completed = milestones.filter((task) => task.status === 'done').length;
          const next = linked.find((task) => task.status !== 'done' && task.status !== 'cancelled');
          const relatedGoal = availableGoals.find((goal) => goal.id === project.goalId);
          return (
            <li key={project.id} className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
                  {project.type}
                </span>
                <span className="rounded-full bg-muted px-2.5 py-1 font-medium capitalize text-muted-foreground">
                  {project.status}
                </span>
              </div>
              <h4 className="mt-3 text-base font-semibold leading-snug text-foreground">
                {project.name}
              </h4>
              {project.description && (
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {project.description}
                </p>
              )}
              {(relatedGoal || project.deadline) && (
                <p className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {relatedGoal && (
                    <span className="rounded-lg bg-muted/70 px-2.5 py-1.5">
                      Goal: {relatedGoal.title}
                    </span>
                  )}
                  {project.deadline && (
                    <span className="rounded-lg bg-muted/70 px-2.5 py-1.5">
                      Due {project.deadline}
                    </span>
                  )}
                </p>
              )}
              <div className="mt-4 rounded-xl border bg-muted/20 p-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-foreground">Milestones</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {milestones.length
                      ? `${completed} of ${milestones.length} complete`
                      : 'None added yet'}
                  </span>
                </div>
                {milestones.length > 0 && (
                  <div
                    className="mt-2 h-1.5 overflow-hidden rounded-full bg-border"
                    role="progressbar"
                    aria-label={`${project.name} milestones complete`}
                    aria-valuemin={0}
                    aria-valuemax={milestones.length}
                    aria-valuenow={completed}
                  >
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(completed / milestones.length) * 100}%` }}
                    />
                  </div>
                )}
                <p className="mt-3 text-xs font-medium text-muted-foreground">Next task</p>
                {next ? (
                  <Link
                    href={`/goals#task-${next.id}`}
                    className="mt-0.5 inline-block text-sm font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    {next.title}
                  </Link>
                ) : (
                  <p className="mt-0.5 text-sm text-muted-foreground">No open tasks yet</p>
                )}
              </div>
              {project.repositoryUrl && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <a
                    href={project.repositoryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-9 items-center rounded-lg border border-primary/20 bg-background px-3 font-medium text-primary shadow-sm transition-colors hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    Repository
                  </a>
                </div>
              )}
              <div className="mt-4 flex flex-wrap items-start gap-2 border-t pt-3">
                <EditProjectForm project={project} goals={availableGoals} />
              </div>
            </li>
          );
        })}
        {!active.length && (
          <li className="rounded-xl border border-dashed bg-muted/20 px-4 py-6 text-sm text-muted-foreground md:col-span-2">
            {allProjects.length
              ? 'No active projects. Add one or restore one from the archive.'
              : 'No projects yet. Start with one piece of work you want to organize.'}
          </li>
        )}
      </ul>

      {archived.length > 0 && (
        <details className="group/archive mt-6 overflow-hidden rounded-xl border">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 bg-muted/30 px-4 text-sm font-semibold text-foreground hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
            <span>Archived projects</span>
            <span className="flex items-center gap-2 text-muted-foreground">
              {archived.length}
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
            {archived.map((project) => (
              <li
                key={project.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm"
              >
                <div>
                  <strong className="font-semibold">{project.name}</strong>
                  <p className="text-xs text-muted-foreground">
                    {project.type} · {project.status}
                  </p>
                </div>
                <ActionForm
                  action={setProjectArchiveAction}
                  submitLabel="Restore project"
                  showSuccess={false}
                  buttonVariant="secondary"
                >
                  <input type="hidden" name="id" value={project.id} />
                  <input type="hidden" name="archive" value="no" />
                </ActionForm>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
