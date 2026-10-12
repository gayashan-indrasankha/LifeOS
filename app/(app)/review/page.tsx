import Link from 'next/link';
import { and, eq, gte, lte } from 'drizzle-orm';
import { ArrowRight, ChartNoAxesCombined, CircleAlert, Compass, Lightbulb } from 'lucide-react';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import {
  dailyNotes,
  englishPractices,
  internshipApplications,
  interviewPractices,
  mealLogs,
  metricEntries,
  milestoneReviews,
  topicPractices,
} from '@/lib/db/schema';
import { getGoals, getProjects, getTasks } from '@/lib/dal/life';
import { getHistoricalHabitsByUser } from '@/lib/dal/habits';
import { getEntriesByUserAndDateRange } from '@/lib/dal/habit-entries';
import { getUserSettings } from '@/lib/dal/user-settings';
import { getTodayInTimezone, toDateString, toZonedTime } from '@/lib/utils/date';
import { isFixedOccurrence } from '@/lib/analytics/habit-month-progress';
import { addCalendarDays, weekdayIndex } from '@/lib/planning/time-blocks';
import { pipelineSummary, weightTrend } from '@/lib/evidence/summary';
import { LIFE_AREAS, normalizeLifeArea } from '@/lib/life-areas';
import { LazyWeightTrend } from '@/components/life/lazy-weight-trend';

export const metadata = { title: 'Monthly Insights | LifeOS' };

const daysInPeriod = 30;
const bucketDays = 6;
const card = 'min-w-0 rounded-2xl border bg-card p-5 shadow-sm sm:p-6';

function shortDate(date: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}

function fullDate(date: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}

function percent(done: number, planned: number) {
  return planned ? Math.round((done / planned) * 100) : null;
}

type Bucket = {
  start: string;
  end: string;
  label: string;
  tasks: number;
  habitDone: number;
  habitPlanned: number;
  study: number;
  interviews: number;
  english: number;
  applications: number;
  portfolio: number;
};

function BarChart({
  title,
  buckets,
  kind,
}: {
  title: string;
  buckets: Bucket[];
  kind: 'tasks' | 'habits';
}) {
  const maxTasks = Math.max(1, ...buckets.map((bucket) => bucket.tasks));
  const description = buckets
    .map((bucket) => {
      const rate = percent(bucket.habitDone, bucket.habitPlanned);
      return `${bucket.label}: ${kind === 'tasks' ? `${bucket.tasks} tasks` : rate === null ? 'no planned habit days' : `${rate}% of planned habit days`}`;
    })
    .join('; ');
  return (
    <div
      role="img"
      aria-label={`${title}. ${description}`}
      className="mt-5 grid grid-cols-5 gap-2 sm:gap-3"
    >
      {buckets.map((bucket) => {
        const value =
          kind === 'tasks' ? bucket.tasks : percent(bucket.habitDone, bucket.habitPlanned);
        const height =
          kind === 'tasks' ? Math.round((bucket.tasks / maxTasks) * 100) : (value ?? 0);
        return (
          <div key={bucket.start} className="flex min-w-0 flex-col items-center">
            <span className="mb-2 text-xs font-bold tabular-nums">
              {value === null ? '—' : kind === 'habits' ? `${value}%` : value}
            </span>
            <div className="flex h-28 w-full items-end rounded-lg bg-muted/50 p-1">
              <div
                className={`w-full rounded-md ${kind === 'tasks' ? 'bg-primary' : 'bg-sky-500'}`}
                style={{ height: `${height}%` }}
              />
            </div>
            <span className="mt-2 text-center text-[11px] leading-tight text-muted-foreground sm:text-xs">
              {bucket.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default async function ReviewPage() {
  const userId = (await requireUser()).id;
  const settings = await getUserSettings(userId);
  const today = toDateString(getTodayInTimezone(settings.timezone));
  const start = addCalendarDays(today, -(daysInPeriod - 1));
  const previousStart = addCalendarDays(start, -daysInPeriod);
  const previousEnd = addCalendarDays(start, -1);
  const [
    tasks,
    goals,
    projects,
    habits,
    entries,
    study,
    interviews,
    english,
    applications,
    portfolioReviews,
    metrics,
    journalDays,
    meals,
  ] = await Promise.all([
    getTasks(userId),
    getGoals(userId),
    getProjects(userId),
    getHistoricalHabitsByUser(userId),
    getEntriesByUserAndDateRange(userId, previousStart, today),
    db
      .select()
      .from(topicPractices)
      .where(
        and(
          eq(topicPractices.userId, userId),
          gte(topicPractices.date, start),
          lte(topicPractices.date, today),
        ),
      ),
    db
      .select()
      .from(interviewPractices)
      .where(
        and(
          eq(interviewPractices.userId, userId),
          gte(interviewPractices.date, start),
          lte(interviewPractices.date, today),
        ),
      ),
    db
      .select()
      .from(englishPractices)
      .where(
        and(
          eq(englishPractices.userId, userId),
          gte(englishPractices.date, start),
          lte(englishPractices.date, today),
        ),
      ),
    db.select().from(internshipApplications).where(eq(internshipApplications.userId, userId)),
    db.select().from(milestoneReviews).where(eq(milestoneReviews.userId, userId)),
    db
      .select()
      .from(metricEntries)
      .where(
        and(
          eq(metricEntries.userId, userId),
          gte(metricEntries.date, start),
          lte(metricEntries.date, today),
        ),
      ),
    db
      .select({ date: dailyNotes.date })
      .from(dailyNotes)
      .where(
        and(
          eq(dailyNotes.userId, userId),
          gte(dailyNotes.date, start),
          lte(dailyNotes.date, today),
        ),
      ),
    settings.nutritionEnabled
      ? db
          .select({ date: mealLogs.date, status: mealLogs.status })
          .from(mealLogs)
          .where(
            and(eq(mealLogs.userId, userId), gte(mealLogs.date, start), lte(mealLogs.date, today)),
          )
      : Promise.resolve([]),
  ]);

  const localDate = (instant: Date) => toDateString(toZonedTime(instant, settings.timezone));
  const finished = tasks
    .filter((task) => task.completedAt)
    .map((task) => ({ task, date: localDate(task.completedAt!) }));
  const currentTasks = finished.filter(({ date }) => date >= start && date <= today);
  const previousTasks = finished.filter(({ date }) => date >= previousStart && date <= previousEnd);
  const completedEntries = entries.filter((entry) => entry.completed);
  const completedHabitSet = new Set(
    completedEntries.map((entry) => `${entry.habitId}:${entry.date}`),
  );
  const habitDays = Array.from({ length: daysInPeriod * 2 }, (_, index) => {
    const date = addCalendarDays(previousStart, index);
    const weekday = (weekdayIndex(date) + 1) % 7;
    const planned = habits.filter((habit) => isFixedOccurrence(habit, date, weekday));
    return {
      date,
      planned: planned.length,
      done: planned.filter((habit) => completedHabitSet.has(`${habit.id}:${date}`)).length,
    };
  });
  const sumHabitDays = (from: string, to: string) =>
    habitDays
      .filter((day) => day.date >= from && day.date <= to)
      .reduce((sum, day) => ({ done: sum.done + day.done, planned: sum.planned + day.planned }), {
        done: 0,
        planned: 0,
      });
  const currentHabits = sumHabitDays(start, today);
  const previousHabits = sumHabitDays(previousStart, previousEnd);
  const habitRate = percent(currentHabits.done, currentHabits.planned);
  const previousHabitRate = percent(previousHabits.done, previousHabits.planned);
  const habitCheckIns = completedEntries.filter((entry) => entry.date >= start).length;
  const mealsFollowed = meals.filter((meal) => meal.status === 'followed').length;
  const submitted = applications.filter(
    (application) =>
      application.appliedOn && application.appliedOn >= start && application.appliedOn <= today,
  );
  const reviewed = portfolioReviews.filter(
    (review) => review.reviewedOn && review.reviewedOn >= start && review.reviewedOn <= today,
  );
  const pipeline = pipelineSummary(applications, today);
  const evidenceTotal =
    study.length + interviews.length + english.length + submitted.length + reviewed.length;
  const scoredStudy = study.filter(
    (item) => item.total != null && item.total > 0 && item.correct != null,
  );
  const scoredQuestions = scoredStudy.reduce((sum, item) => sum + item.total!, 0);
  const correctQuestions = scoredStudy.reduce((sum, item) => sum + item.correct!, 0);
  const portfolioNeedsWork = portfolioReviews.filter(
    (review) => review.state === 'needs_improvements',
  ).length;

  const buckets: Bucket[] = Array.from({ length: daysInPeriod / bucketDays }, (_, index) => {
    const bucketStart = addCalendarDays(start, index * bucketDays);
    const bucketEnd = addCalendarDays(bucketStart, bucketDays - 1);
    const inBucket = (date: string | null) =>
      Boolean(date && date >= bucketStart && date <= bucketEnd);
    const habit = sumHabitDays(bucketStart, bucketEnd);
    return {
      start: bucketStart,
      end: bucketEnd,
      label: `${shortDate(bucketStart)}–${shortDate(bucketEnd)}`,
      tasks: currentTasks.filter(({ date }) => inBucket(date)).length,
      habitDone: habit.done,
      habitPlanned: habit.planned,
      study: study.filter((item) => inBucket(item.date)).length,
      interviews: interviews.filter((item) => inBucket(item.date)).length,
      english: english.filter((item) => inBucket(item.date)).length,
      applications: submitted.filter((item) => inBucket(item.appliedOn)).length,
      portfolio: reviewed.filter((item) => inBucket(item.reviewedOn)).length,
    };
  });
  const evidenceRows = [
    { label: 'Study', key: 'study' as const, total: study.length },
    { label: 'Interviews', key: 'interviews' as const, total: interviews.length },
    { label: 'English', key: 'english' as const, total: english.length },
    { label: 'Applications', key: 'applications' as const, total: submitted.length },
    { label: 'Portfolio reviews', key: 'portfolio' as const, total: reviewed.length },
  ];
  const activeGoals = goals.filter((goal) => goal.status === 'active' && !goal.archivedAt);
  const projectGoal = new Map(projects.map((project) => [project.id, project.goalId]));
  const goalOfTask = (task: (typeof tasks)[number]) =>
    task.goalId ?? (task.projectId ? projectGoal.get(task.projectId) : null);
  const goalProgress = activeGoals
    .map((goal) => {
      const linked = tasks.filter(
        (task) => goalOfTask(task) === goal.id && task.status !== 'cancelled',
      );
      const done = currentTasks.filter(({ task }) => goalOfTask(task) === goal.id).length;
      return { goal, linked: linked.length, done };
    })
    .sort(
      (first, second) => second.done - first.done || first.goal.priority - second.goal.priority,
    );
  const trackedAreas = [
    ...new Set([
      ...goals.filter((goal) => !goal.archivedAt).map((goal) => normalizeLifeArea(goal.area)),
      ...tasks
        .filter((task) => task.status !== 'cancelled')
        .map((task) => normalizeLifeArea(task.area)),
    ]),
  ];
  const areaOrder = [
    ...LIFE_AREAS.filter((area) => trackedAreas.includes(area)),
    ...trackedAreas
      .filter((area) => !LIFE_AREAS.includes(area as (typeof LIFE_AREAS)[number]))
      .sort(),
  ];
  const areas = areaOrder.map((area) => ({
    area,
    count: currentTasks.filter(({ task }) => normalizeLifeArea(task.area) === area).length,
  }));
  const maxArea = Math.max(1, ...areas.map((area) => area.count));
  const overdueTasks = tasks.filter(
    (task) => !['done', 'cancelled'].includes(task.status) && task.dueDate && task.dueDate < today,
  );
  const stalledGoals = goalProgress.filter(({ linked, done }) => linked > 0 && done === 0);
  const actionItems: { title: string; detail: string; href: string; cta: string }[] = [];
  if (pipeline.overdue > 0)
    actionItems.push({
      title: 'Follow up on applications',
      detail: `${pipeline.overdue} follow-up ${pipeline.overdue === 1 ? 'date has' : 'dates have'} passed.`,
      href: '/goals/evidence#applications',
      cta: 'Open applications',
    });
  if (overdueTasks.length > 0)
    actionItems.push({
      title: 'Replan overdue tasks',
      detail: `${overdueTasks.length} unfinished ${overdueTasks.length === 1 ? 'task is' : 'tasks are'} past the end date.`,
      href: '/goals?view=tasks',
      cta: 'Open tasks',
    });
  if (habitRate !== null && currentHabits.planned >= 8 && habitRate < 60)
    actionItems.push({
      title: 'Make habits easier to keep',
      detail: `${habitRate}% of planned habit days were completed. Review the schedule or goal.`,
      href: '/habits',
      cta: 'Open habits',
    });
  if (portfolioNeedsWork > 0)
    actionItems.push({
      title: 'Review portfolio feedback',
      detail: `${portfolioNeedsWork} ${portfolioNeedsWork === 1 ? 'review needs' : 'reviews need'} improvements.`,
      href: '/goals?view=projects',
      cta: 'Open projects',
    });
  if (stalledGoals.length > 0)
    actionItems.push({
      title: 'Choose a next step for a goal',
      detail: `${stalledGoals.length} active ${stalledGoals.length === 1 ? 'goal has' : 'goals have'} linked tasks but none finished this month.`,
      href: '/goals?view=goals',
      cta: 'Open goals',
    });
  if (evidenceTotal === 0 && activeGoals.some((goal) => normalizeLifeArea(goal.area) === 'Career'))
    actionItems.push({
      title: 'Record career practice',
      detail: 'No career evidence was saved in the past 30 days.',
      href: '/goals/evidence',
      cta: 'Open evidence',
    });
  if (actionItems.length === 0)
    actionItems.push({
      title: 'Plan the next month',
      detail: 'Turn what you noticed into a few tasks linked to your goals or projects.',
      href: '/goals?view=tasks',
      cta: 'Add tasks in Goals & Projects',
    });
  const weightPoints = weightTrend(
    metrics
      .filter((metric) => metric.type === 'Body weight' && metric.unit === 'kg')
      .map((metric) => ({ date: metric.date, value: metric.value })),
    settings.weekStartsOn,
    null,
  ).daily;
  const weightTarget =
    activeGoals.find(
      (goal) => normalizeLifeArea(goal.area) === 'Fitness' && goal.targetUnit === 'kg',
    )?.targetValue ?? null;
  const periodsWithEvidence = buckets.filter(
    (bucket) =>
      bucket.study + bucket.interviews + bucket.english + bucket.applications + bucket.portfolio >
      0,
  ).length;

  return (
    <main className="mx-auto max-w-6xl space-y-7 pb-12">
      <header className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ChartNoAxesCombined className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary">
              Monthly insights
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Notice, learn, adjust</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              A clear picture of the past 30 days, with the next steps that need your attention.
            </p>
            <p className="mt-3 text-sm font-semibold">
              {fullDate(start)} – {fullDate(today)}
            </p>
          </div>
        </div>
      </header>

      <section aria-labelledby="notice-heading" className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
            01
          </span>
          <h2 id="notice-heading" className="text-xl font-bold">
            Notice what happened
          </h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className={card}>
            <p className="text-sm text-muted-foreground">Tasks finished</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">{currentTasks.length}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {previousTasks.length} in the previous 30 days
            </p>
          </div>
          <div className={card}>
            <p className="text-sm text-muted-foreground">Planned habit days completed</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">
              {habitRate === null ? '—' : `${habitRate}%`}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {currentHabits.done} of {currentHabits.planned} planned days · {habitCheckIns} total
              check-ins
            </p>
          </div>
          <div className={card}>
            <p className="text-sm text-muted-foreground">Evidence recorded</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">{evidenceTotal}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Study, practice, applications, and portfolio reviews
            </p>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <section className={card} aria-labelledby="task-chart-title">
            <h3 id="task-chart-title" className="font-bold">
              Tasks finished over time
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">Each bar covers six days.</p>
            <BarChart
              title="Tasks finished in each six-day period"
              buckets={buckets}
              kind="tasks"
            />
          </section>
          <section className={card} aria-labelledby="habit-chart-title">
            <h3 id="habit-chart-title" className="font-bold">
              Habit consistency
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Completed planned days in each six-day period.
            </p>
            <BarChart
              title="Percentage of planned habit days completed in each six-day period"
              buckets={buckets}
              kind="habits"
            />
          </section>
        </div>
      </section>

      <section aria-labelledby="learn-heading" className="android-learn-section space-y-4">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
            02
          </span>
          <h2 id="learn-heading" className="text-xl font-bold">
            Learn from the pattern
          </h2>
        </div>
        <div className="android-learn-grid grid gap-4 lg:grid-cols-2">
          <section className={`android-learn-card ${card}`} aria-labelledby="areas-heading">
            <h3 id="areas-heading" className="font-bold">
              Tasks finished by life area
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">Only areas you use are shown.</p>
            {areas.length ? (
              <div className="mt-5 space-y-4">
                {areas.map(({ area, count }) => (
                  <div key={area}>
                    <div className="mb-1.5 flex justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate font-medium">{area}</span>
                      <span className="font-bold tabular-nums">{count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(count / maxArea) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-5 text-sm text-muted-foreground">
                No life areas are being tracked yet.
              </p>
            )}
          </section>
          <section className={`android-learn-card ${card}`} aria-labelledby="evidence-heading">
            <div className="android-review-heading flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 id="evidence-heading" className="font-bold">
                  Evidence by period
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Entries recorded in each six-day period.
                </p>
              </div>
              <Link
                href="/goals/evidence"
                className="android-secondary-action text-sm font-semibold text-primary hover:underline"
              >
                Open evidence <ArrowRight className="inline size-4" aria-hidden="true" />
              </Link>
            </div>
            <div className="android-evidence-scroll themed-scrollbar mt-4 overflow-x-auto">
              <table className="w-full min-w-[410px] border-separate border-spacing-y-1 text-xs">
                <caption className="sr-only">Recorded evidence across five six-day periods</caption>
                <thead>
                  <tr>
                    <th scope="col" className="pr-2 text-left font-medium text-muted-foreground">
                      Activity
                    </th>
                    {buckets.map((bucket) => (
                      <th
                        key={bucket.start}
                        scope="col"
                        className="px-1 text-center font-medium text-muted-foreground"
                      >
                        {shortDate(bucket.start)}
                      </th>
                    ))}
                    <th scope="col" className="pl-2 text-right font-medium text-muted-foreground">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {evidenceRows.map((row) => (
                    <tr key={row.key}>
                      <th scope="row" className="pr-2 text-left font-medium">
                        {row.label}
                      </th>
                      {buckets.map((bucket) => {
                        const count = bucket[row.key];
                        return (
                          <td key={bucket.start} className="px-1 py-1 text-center">
                            <span
                              className={`block rounded-md py-2 font-semibold tabular-nums ${count ? 'bg-primary/15 text-primary' : 'bg-muted/40 text-muted-foreground'}`}
                            >
                              {count}
                            </span>
                          </td>
                        );
                      })}
                      <td className="pl-2 text-right font-bold tabular-nums">{row.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {evidenceTotal === 0 && (
              <p className="mt-3 text-sm text-muted-foreground">
                No evidence entries were recorded in this period.
              </p>
            )}
            {(scoredQuestions > 0 || portfolioNeedsWork > 0) && (
              <p className="mt-3 text-xs text-muted-foreground">
                {scoredQuestions > 0 &&
                  `Scored study practice: ${correctQuestions} of ${scoredQuestions} questions correct.`}
                {scoredQuestions > 0 && portfolioNeedsWork > 0 && ' '}
                {portfolioNeedsWork > 0 &&
                  `Portfolio reviews needing improvement now: ${portfolioNeedsWork}.`}
              </p>
            )}
          </section>
        </div>
        <div className="android-learn-grid grid gap-4 lg:grid-cols-2">
          <section className={`android-learn-card ${card}`} aria-labelledby="goal-heading">
            <div className="android-review-heading flex items-start justify-between gap-3">
              <div>
                <h3 id="goal-heading" className="font-bold">
                  Goals in motion
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Linked tasks finished in the past 30 days.
                </p>
              </div>
              <Link
                href="/goals?view=goals"
                className="android-secondary-action text-sm font-semibold text-primary hover:underline"
              >
                View goals
              </Link>
            </div>
            {goalProgress.length ? (
              <ul className="mt-4 space-y-3">
                {goalProgress.slice(0, 5).map(({ goal, linked, done }) => (
                  <li key={goal.id} className="rounded-xl border bg-muted/20 px-3 py-3">
                    <div className="flex flex-wrap justify-between gap-2 text-sm">
                      <span className="font-semibold">{goal.title}</span>
                      <span className="text-muted-foreground">
                        {linked ? `${done} finished` : 'No linked tasks'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {normalizeLifeArea(goal.area)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">No active goals yet.</p>
            )}
          </section>
          <section className={`android-learn-card ${card}`} aria-labelledby="outcomes-heading">
            <h3 id="outcomes-heading" className="font-bold">
              Recorded outcomes
            </h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-2xl font-bold tabular-nums">{submitted.length}</p>
                <p className="text-xs text-muted-foreground">Applications submitted</p>
              </div>
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-2xl font-bold tabular-nums">{pipeline.active}</p>
                <p className="text-xs text-muted-foreground">Applications active now</p>
              </div>
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-2xl font-bold tabular-nums">
                  {reviewed.filter((item) => item.state === 'meets_criteria').length}
                </p>
                <p className="text-xs text-muted-foreground">Portfolio reviews meeting criteria</p>
              </div>
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-2xl font-bold tabular-nums">
                  {new Set(weightPoints.map((item) => item.date)).size}
                </p>
                <p className="text-xs text-muted-foreground">Days with weight readings</p>
              </div>
            </div>
            {weightPoints.length >= 2 && (
              <div className="mt-5 border-t pt-4">
                <p className="text-sm font-semibold">Body-weight readings</p>
                <LazyWeightTrend points={weightPoints} target={weightTarget} />
              </div>
            )}
            <p className="mt-4 text-xs text-muted-foreground">
              These are recorded results; missing entries do not mean no progress.
            </p>
            {settings.nutritionEnabled && (
              <p className="mt-2 text-xs text-muted-foreground">
                {mealsFollowed} meals eaten as planned this month.
              </p>
            )}
          </section>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-4 text-sm">
            <p className="font-semibold">Task pace</p>
            <p className="mt-1 text-muted-foreground">
              {currentTasks.length} finished now, compared with {previousTasks.length} in the prior
              30 days.
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4 text-sm">
            <p className="font-semibold">Habit pattern</p>
            <p className="mt-1 text-muted-foreground">
              {habitRate === null
                ? 'No set-day habit schedule to compare.'
                : `${habitRate}% now${previousHabitRate === null ? '.' : `, compared with ${previousHabitRate}% previously.`}`}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4 text-sm">
            <p className="font-semibold">Evidence spread</p>
            <p className="mt-1 text-muted-foreground">
              Activity was recorded in {periodsWithEvidence} of 5 periods; journal entries on{' '}
              {journalDays.length} days. This shows what was saved, not the quality of your work.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="adjust-heading" className={card}>
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Compass className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary">03 · Adjust</p>
            <h2 id="adjust-heading" className="text-xl font-bold">
              What to do next
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Suggestions based on what is recorded, not a judgment of your effort.
            </p>
          </div>
        </div>
        <ul className="mt-5 grid gap-3 md:grid-cols-3">
          {actionItems.slice(0, 3).map((item) => (
            <li key={item.title} className="rounded-xl border bg-muted/20 p-4">
              <div className="flex items-start gap-2">
                {item.title.includes('overdue') || item.title.includes('Follow') ? (
                  <CircleAlert
                    className="mt-0.5 size-4 shrink-0 text-amber-600"
                    aria-hidden="true"
                  />
                ) : (
                  <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                )}
                <div>
                  <h3 className="text-sm font-bold">{item.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {item.detail}
                  </p>
                </div>
              </div>
              <Link
                href={item.href}
                className="mt-4 inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-primary hover:underline"
              >
                {item.cta} <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <p className="text-xs text-muted-foreground">
        Planned habit percentages include habits assigned to specific days. Flexible weekly habits
        appear in total check-ins. All figures use your saved entries through today.
      </p>
    </main>
  );
}
