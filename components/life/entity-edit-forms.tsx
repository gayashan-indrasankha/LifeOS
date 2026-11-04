import type { goals, projects } from '@/lib/db/schema';
import {
  editGoalAction,
  editProjectAction,
  setGoalArchiveAction,
  setProjectArchiveAction,
} from '@/lib/actions/life-actions';
import { ActionForm } from './action-form';
import { AreaField } from './area-field';
import { normalizeLifeArea } from '@/lib/life-areas';

type Goal = typeof goals.$inferSelect;
type Project = typeof projects.$inferSelect;
const field = 'mt-1 min-h-10 w-full rounded-lg border bg-background px-3';
const statusOptions = ['active', 'paused', 'completed', 'cancelled'] as const;

export function EditGoalForm({ goal, areas }: { goal: Goal; areas: string[] }) {
  return (
    <div className="contents">
      <details className="group min-w-0 open:basis-full">
        <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-lg bg-primary/5 px-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
          Edit goal
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
          action={editGoalAction}
          submitLabel="Save goal"
          showSuccess={false}
          successConfirmation="Goal saved"
          className="mt-3 grid gap-4 rounded-xl border bg-background p-4 sm:grid-cols-2"
        >
          <input type="hidden" name="id" value={goal.id} />
          <AreaField
            label="Life area"
            options={areas}
            defaultValue={normalizeLifeArea(goal.area)}
          />
          <label className="text-sm">
            Title
            <input
              name="title"
              required
              maxLength={160}
              defaultValue={goal.title}
              className={field}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            Description
            <textarea
              name="description"
              maxLength={2000}
              defaultValue={goal.description ?? ''}
              className="mt-1 min-h-24 w-full rounded-lg border bg-background p-3"
            />
          </label>
          <label className="text-sm">
            Priority
            <select name="priority" defaultValue={goal.priority} className={field}>
              <option value="1">High</option>
              <option value="2">Medium</option>
              <option value="3">Low</option>
            </select>
          </label>
          <label className="text-sm">
            Status
            <select name="status" defaultValue={goal.status} className={field}>
              {statusOptions.map((item) => (
                <option key={item} value={item}>
                  {item.charAt(0).toUpperCase() + item.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Target date
            <input
              type="date"
              name="targetDate"
              defaultValue={goal.targetDate ?? ''}
              className={field}
            />
          </label>
          <label className="text-sm">
            Measurable target
            <input
              type="number"
              min="0"
              step="any"
              name="targetValue"
              defaultValue={goal.targetValue ?? ''}
              className={field}
            />
          </label>
          <label className="text-sm">
            Unit
            <input
              name="targetUnit"
              maxLength={32}
              defaultValue={goal.targetUnit ?? ''}
              className={field}
            />
          </label>
        </ActionForm>
      </details>
      <details className="min-w-0 open:basis-full">
        <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-lg border bg-background px-3.5 py-2 text-sm font-medium text-muted-foreground shadow-sm transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="size-4">
            <path
              d="M3.5 5.5h13v3h-13v-3ZM5 8.5V16h10V8.5M8 11.5h4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Archive goal
        </summary>
        <ActionForm
          action={setGoalArchiveAction}
          submitLabel="Archive goal"
          className="mt-3 space-y-3 rounded-xl border bg-card p-3"
        >
          <input type="hidden" name="id" value={goal.id} />
          <input type="hidden" name="archive" value="yes" />
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" name="confirm" value="yes" required /> Keep linked work and hide
            this goal from the active list
          </label>
        </ActionForm>
      </details>
    </div>
  );
}

export function EditProjectForm({
  project,
  goals: availableGoals,
}: {
  project: Project;
  goals: Goal[];
}) {
  return (
    <div className="contents">
      <details className="group min-w-0 open:basis-full">
        <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-lg bg-primary/5 px-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
          Edit project
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
          action={editProjectAction}
          submitLabel="Save project"
          showSuccess={false}
          successConfirmation="Project saved"
          className="mt-3 grid gap-4 rounded-xl border bg-background p-4 sm:grid-cols-2"
        >
          <input type="hidden" name="id" value={project.id} />
          <label className="text-sm">
            Name
            <input
              name="name"
              required
              maxLength={160}
              defaultValue={project.name}
              className={field}
            />
          </label>
          <label className="text-sm">
            Type
            <select name="type" defaultValue={project.type} className={field}>
              <option>General</option>
              <option>UCSC Industry Project</option>
              <option>Software Engineering Portfolio</option>
              <option>AI Engineering Portfolio</option>
              <option>DevOps Portfolio</option>
            </select>
          </label>
          <label className="text-sm sm:col-span-2">
            Description
            <textarea
              name="description"
              maxLength={2000}
              defaultValue={project.description ?? ''}
              className="mt-1 min-h-24 w-full rounded-lg border bg-background p-3"
            />
          </label>
          <label className="text-sm">
            Related goal
            <select name="goalId" defaultValue={project.goalId ?? ''} className={field}>
              <option value="">None</option>
              {availableGoals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.title}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Status
            <select name="status" defaultValue={project.status} className={field}>
              {statusOptions.map((item) => (
                <option key={item} value={item}>
                  {item.charAt(0).toUpperCase() + item.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Deadline
            <input
              type="date"
              name="deadline"
              defaultValue={project.deadline ?? ''}
              className={field}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            Repository URL
            <input
              type="url"
              name="repositoryUrl"
              defaultValue={project.repositoryUrl ?? ''}
              className={field}
            />
          </label>
        </ActionForm>
      </details>
      <details className="min-w-0 open:basis-full">
        <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-lg border bg-background px-3.5 py-2 text-sm font-medium text-muted-foreground shadow-sm transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="size-4">
            <path
              d="M3.5 5.5h13v3h-13v-3ZM5 8.5V16h10V8.5M8 11.5h4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Archive project
        </summary>
        <ActionForm
          action={setProjectArchiveAction}
          submitLabel="Archive project"
          showSuccess={false}
          className="mt-3 space-y-3 rounded-xl border bg-card p-3"
        >
          <input type="hidden" name="id" value={project.id} />
          <input type="hidden" name="archive" value="yes" />
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" name="confirm" value="yes" required /> Keep tasks and milestones
            and hide this project from the active list
          </label>
        </ActionForm>
      </details>
    </div>
  );
}
