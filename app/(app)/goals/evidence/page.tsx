import Link from 'next/link';
import { and, asc, desc, eq, gte } from 'drizzle-orm';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import {
  applicationStageHistory,
  englishPractices,
  internshipApplications,
  interviewPractices,
  interviewTopics,
} from '@/lib/db/schema';
import { getUserSettings } from '@/lib/dal/user-settings';
import { getTodayInTimezone, serverNow, toDateString, toZonedTime } from '@/lib/utils/date';
import { addCalendarDays } from '@/lib/planning/time-blocks';
import { pipelineSummary } from '@/lib/evidence/summary';
import { ActionForm } from '@/components/life/action-form';
import { ApplicationActionPanels } from '@/components/life/application-action-panels';
import { ApplicationStageFields } from '@/components/life/application-stage-fields';
import { DeleteApplicationButton } from '@/components/life/delete-application-button';
import { EnglishPracticeCard } from '@/components/life/english-practice-card';
import { EnglishPracticeForm } from '@/components/life/english-practice-form';
import { InterviewPracticeForm } from '@/components/life/interview-practice-form';
import { InterviewPracticeCard } from '@/components/life/interview-practice-card';
import {
  changeApplicationStageAction,
  createApplicationFollowUpAction,
  saveApplicationAction,
} from '@/lib/actions/evidence-actions';

export const metadata = { title: 'Evidence & Career Readiness | LifeOS' };

const field = 'mt-1.5 min-h-11 w-full rounded-lg border bg-background px-3';
const label = 'block text-sm font-medium';
const stages = [
  ['saved', 'Not applied yet'],
  ['applied', 'Applied'],
  ['online_assessment', 'Online assessment'],
  ['technical_interview', 'Technical interview'],
  ['hr_interview', 'HR interview'],
  ['offer', 'Offer'],
  ['rejected', 'Rejected'],
  ['withdrawn', 'Withdrawn'],
  ['custom', 'Other stage'],
] as const;
const stageLabel = (stage: string | null) =>
  stage == null
    ? 'Added'
    : (stages.find(([key]) => key === stage)?.[1] ?? stage.replaceAll('_', ' '));
const sectionClass =
  'scroll-mt-32 space-y-5 rounded-2xl border bg-card p-5 shadow-sm sm:p-7 lg:scroll-mt-20';
export default async function EvidencePage({
  searchParams,
}: {
  searchParams: Promise<{ track?: string; stage?: string }>;
}) {
  const userId = (await requireUser()).id;
  const settings = await getUserSettings(userId);
  const today = toDateString(getTodayInTimezone(settings.timezone));
  const renderedAt = serverNow().toISOString();
  const localDate = (instant: Date) => toDateString(toZonedTime(instant, settings.timezone));
  const since = addCalendarDays(today, -180);
  const query = await searchParams;
  const [interviewCatalog, interviews, english, applications, history] = await Promise.all([
    db
      .select()
      .from(interviewTopics)
      .where(eq(interviewTopics.userId, userId))
      .orderBy(asc(interviewTopics.category), asc(interviewTopics.title)),
    db
      .select()
      .from(interviewPractices)
      .where(and(eq(interviewPractices.userId, userId), gte(interviewPractices.date, since)))
      .orderBy(desc(interviewPractices.date))
      .limit(200),
    db
      .select()
      .from(englishPractices)
      .where(and(eq(englishPractices.userId, userId), gte(englishPractices.date, since)))
      .orderBy(desc(englishPractices.date))
      .limit(200),
    db
      .select()
      .from(internshipApplications)
      .where(eq(internshipApplications.userId, userId))
      .orderBy(desc(internshipApplications.updatedAt))
      .limit(300),
    db
      .select()
      .from(applicationStageHistory)
      .where(eq(applicationStageHistory.userId, userId))
      .orderBy(desc(applicationStageHistory.changedAt), desc(applicationStageHistory.id))
      .limit(150),
  ]);
  const pipeline = pipelineSummary(applications, today);
  const filteredApplications = applications.filter(
    (item) =>
      (!query.track || item.roleTrack === query.track) &&
      (!query.stage || item.stage === query.stage),
  );
  const latestStageChange = new Map<string, string | null>();
  const applicationDates = new Map(applications.map((item) => [item.id, item.appliedOn]));
  for (const event of history) {
    if (!latestStageChange.has(event.applicationId)) {
      latestStageChange.set(
        event.applicationId,
        event.toStage === 'applied'
          ? (applicationDates.get(event.applicationId) ?? event.stageOn)
          : event.stageOn,
      );
    }
  }
  const areas = [
    {
      id: 'interviews',
      title: 'Interviews',
      detail: 'Technical practice',
    },
    { id: 'english', title: 'English', detail: 'Speaking practice' },
    {
      id: 'applications',
      title: 'Applications',
      detail: 'Opportunities and follow-ups',
    },
  ];
  return (
    <div className="evidence-page mx-auto max-w-6xl space-y-6">
      <header className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <Link
          href="/goals"
          className="inline-flex min-h-9 items-center rounded-lg border bg-background px-3 text-sm font-semibold text-primary transition-colors hover:border-primary/30 hover:bg-primary/5"
        >
          ← Goals & Projects
        </Link>
        <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
          Evidence & career readiness
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Choose an area to record what you did and see your progress.
        </p>
        <nav
          aria-label="Evidence sections"
          className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {areas.map((area, index) => (
            <a
              key={area.id}
              href={`#${area.id}`}
              className="group flex min-h-24 items-center gap-3 rounded-xl border bg-background p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-foreground">{area.title}</span>
                <span className="block text-xs text-muted-foreground">{area.detail}</span>
              </span>
              <span aria-hidden="true" className="text-primary group-hover:translate-x-0.5">
                →
              </span>
            </a>
          ))}
        </nav>
      </header>

      <section id="interviews" className={sectionClass}>
        <div>
          <h2 className="evidence-section-heading text-xl font-bold">Interview practice</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Write what you practised and how long you spent. You can edit or delete a session until
            midnight on the day you added it.
          </p>
        </div>
        <div className="rounded-2xl border bg-muted/20 p-4 sm:p-5">
          <h3 className="text-base font-semibold">Record practice</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter a topic for this session. It will appear in your practice history.
          </p>
          <InterviewPracticeForm today={today} />
        </div>
        <div className="flex flex-wrap gap-2 text-sm" aria-label="Interview practice summary">
          <span className="rounded-lg bg-muted px-3 py-2">
            <strong>{interviews.length}</strong> sessions in the last 180 days
          </span>
          <span className="rounded-lg bg-muted px-3 py-2">
            <strong>
              {new Set(interviews.map((item) => item.topicText ?? item.topicId)).size}
            </strong>{' '}
            topics practised
          </span>
          <span className="rounded-lg bg-muted px-3 py-2">
            <strong>
              {interviews.reduce((total, item) => total + (item.durationMinutes ?? 0), 0)}
            </strong>{' '}
            minutes
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {interviews.slice(0, 8).map((item) => (
            <InterviewPracticeCard
              key={item.id}
              practice={{
                id: item.id,
                date: item.date,
                createdAt: item.createdAt.toISOString(),
                roleTrack: item.roleTrack,
                topic:
                  item.topicText ??
                  interviewCatalog.find((topic) => topic.id === item.topicId)?.title ??
                  'Topic',
                type: item.type,
                durationMinutes: item.durationMinutes,
              }}
              today={today}
              renderedAt={renderedAt}
              timezone={settings.timezone}
            />
          ))}
          {!interviews.length && (
            <p className="rounded-xl border border-dashed bg-muted/20 px-4 py-6 text-sm text-muted-foreground md:col-span-2">
              No interview practice recorded yet. Enter a topic and save your first session.
            </p>
          )}
        </div>
      </section>

      <section id="english" className={sectionClass}>
        <div>
          <h2 className="evidence-section-heading text-xl font-bold">English practice</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Log what you practised and for how long. You can edit or delete a session until midnight
            on the day you added it.
          </p>
        </div>
        <div className="rounded-2xl border bg-muted/20 p-4 sm:p-5">
          <h3 className="text-base font-semibold">Record practice</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Add one session with its date, type, topic, and minutes.
          </p>
          <EnglishPracticeForm today={today} />
        </div>
        <div className="flex flex-wrap gap-2 text-sm" aria-label="English practice summary">
          <span className="rounded-lg bg-muted px-3 py-2">
            <strong>{english.length}</strong> sessions in the last 180 days
          </span>
          <span className="rounded-lg bg-muted px-3 py-2">
            <strong>{english.reduce((sum, item) => sum + item.durationMinutes, 0)}</strong> minutes
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {english.slice(0, 8).map((item) => (
            <EnglishPracticeCard
              key={item.id}
              practice={{
                id: item.id,
                date: item.date,
                createdAt: item.createdAt.toISOString(),
                type: item.type,
                topic: item.topic,
                durationMinutes: item.durationMinutes,
              }}
              today={today}
              renderedAt={renderedAt}
              timezone={settings.timezone}
            />
          ))}
          {!english.length && (
            <p className="rounded-xl border border-dashed bg-muted/20 px-4 py-6 text-sm text-muted-foreground md:col-span-2">
              No English practice recorded yet. Add your first session above.
            </p>
          )}
        </div>
      </section>
      <section id="applications" className={sectionClass}>
        <div>
          <h2 className="evidence-section-heading text-xl font-bold">Internship applications</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Save opportunities and update each application as it moves forward.
          </p>
        </div>
        {applications.length > 0 && (
          <div className="flex flex-wrap gap-2 text-sm" aria-label="Application summary">
            <span className="rounded-lg bg-muted px-3 py-2">
              <strong>{applications.length}</strong> tracked
            </span>
            <span className="rounded-lg bg-muted px-3 py-2">
              <strong>{pipeline.submitted}</strong> submitted
            </span>
            {pipeline.active > 0 && (
              <span className="rounded-lg bg-muted px-3 py-2">{pipeline.active} active</span>
            )}
            {pipeline.assessments > 0 && (
              <span className="rounded-lg bg-muted px-3 py-2">
                {pipeline.assessments} assessments
              </span>
            )}
            {pipeline.interviews > 0 && (
              <span className="rounded-lg bg-muted px-3 py-2">
                {pipeline.interviews} interview stages
              </span>
            )}
            {pipeline.offers > 0 && (
              <span className="rounded-lg bg-muted px-3 py-2">{pipeline.offers} offers</span>
            )}
            {pipeline.rejected > 0 && (
              <span className="rounded-lg bg-muted px-3 py-2">{pipeline.rejected} rejected</span>
            )}
            {pipeline.overdue > 0 && (
              <span className="rounded-lg bg-muted px-3 py-2">
                {pipeline.overdue} overdue follow-ups
              </span>
            )}
          </div>
        )}
        <div className="rounded-2xl border bg-muted/20 p-4 sm:p-5">
          <h3 className="text-base font-semibold">Add an opportunity</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Track a role before or after applying. Add the application date if you have submitted
            it.
          </p>
          <ActionForm
            action={saveApplicationAction}
            submitLabel="Save opportunity"
            showSuccess={false}
            successConfirmation="Saved"
            className="mt-4 grid gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            <label className="block text-sm font-semibold text-foreground">
              Company
              <input name="company" maxLength={160} required className={field} />
            </label>
            <label className="block text-sm font-semibold text-foreground">
              Role title
              <input name="roleTitle" maxLength={160} required className={field} />
            </label>
            <label className="block text-sm font-semibold text-foreground sm:col-span-2 lg:col-span-1">
              Track
              <select name="roleTrack" className={field}>
                <option>SE</option>
                <option>AI</option>
                <option>DevOps</option>
                <option>QA</option>
                <option>Other</option>
              </select>
            </label>
            <div className="col-span-full grid gap-x-4 gap-y-4 rounded-xl border bg-background p-4 sm:grid-cols-2 lg:grid-cols-3">
              <ApplicationStageFields options={stages} today={today} mode="create" />
              <label className="block text-sm font-medium">
                Follow-up date
                <input type="date" name="followUpDate" className={field} />
              </label>
              <label className="block text-sm font-medium">
                Application URL
                <input type="url" name="url" placeholder="https://…" className={field} />
              </label>
              <label className="block text-sm font-medium">
                Location
                <input name="location" maxLength={160} className={field} />
              </label>
              <label className="block text-sm font-medium">
                Arrangement
                <select name="arrangement" className={field}>
                  <option value="">Unspecified</option>
                  <option value="onsite">On site</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="remote">Remote</option>
                </select>
              </label>
              <label className="block text-sm font-medium">
                Contact name
                <input name="contactName" maxLength={160} className={field} />
              </label>
              <label className="block text-sm font-medium sm:col-span-2 lg:col-span-2">
                Private note
                <textarea
                  name="note"
                  maxLength={2000}
                  rows={3}
                  className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2"
                />
              </label>
            </div>
          </ActionForm>
        </div>
        {applications.length > 0 && (
          <div className="rounded-2xl border bg-background p-4 sm:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-base font-semibold">Your opportunities</h3>
              <span className="text-xs text-muted-foreground">
                {filteredApplications.length} shown
              </span>
            </div>
            <form method="get" className="mt-4 flex flex-wrap items-end gap-3 text-sm">
              <label className="block min-w-36 flex-1 text-sm font-semibold text-foreground sm:max-w-52">
                Track
                <select name="track" defaultValue={query.track ?? ''} className={field}>
                  <option value="">All tracks</option>
                  <option>SE</option>
                  <option>AI</option>
                  <option>DevOps</option>
                  <option>QA</option>
                  <option>Other</option>
                </select>
              </label>
              <label className="block min-w-36 flex-1 text-sm font-semibold text-foreground sm:max-w-52">
                Stage
                <select name="stage" defaultValue={query.stage ?? ''} className={field}>
                  <option value="">All stages</option>
                  {stages.map(([key, text]) => (
                    <option key={key} value={key}>
                      {text}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="min-h-11 rounded-lg border bg-background px-4 text-sm font-semibold text-primary transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                Apply filters
              </button>
              {(query.track || query.stage) && (
                <Link
                  href="/goals/evidence#applications"
                  className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Clear
                </Link>
              )}
            </form>
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          {filteredApplications.map((item) => (
            <article
              key={item.id}
              className="min-w-0 rounded-2xl border bg-background p-4 text-sm shadow-sm sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words text-lg font-semibold leading-tight">
                    {item.company}
                  </h3>
                  <p className="mt-1 font-medium text-foreground/80">{item.roleTitle}</p>
                </div>
                <div className="flex items-start gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      ['rejected', 'withdrawn'].includes(item.stage)
                        ? 'bg-destructive/10 text-destructive'
                        : item.stage === 'saved'
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-primary/10 text-primary'
                    }`}
                  >
                    {stageLabel(item.stage)}
                  </span>
                  <DeleteApplicationButton id={item.id} company={item.company} />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="rounded-md bg-muted/60 px-2.5 py-1">{item.roleTrack}</span>
                {item.location && (
                  <span className="rounded-md bg-muted/60 px-2.5 py-1">{item.location}</span>
                )}
                {item.arrangement && (
                  <span className="rounded-md bg-muted/60 px-2.5 py-1 capitalize">
                    {item.arrangement.replace('_', ' ')}
                  </span>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 rounded-xl border bg-muted/20 px-3 py-2.5 text-xs">
                <p>
                  <span className="block text-muted-foreground">Application</span>
                  <span className="mt-0.5 block font-semibold text-foreground">
                    {item.appliedOn ? `Submitted ${item.appliedOn}` : 'Not submitted'}
                  </span>
                </p>
                {latestStageChange.get(item.id) && (
                  <p>
                    <span className="block text-muted-foreground">Current stage since</span>
                    <span className="mt-0.5 block font-semibold text-foreground">
                      {latestStageChange.get(item.id)}
                    </span>
                  </p>
                )}
                {item.followUpDate && (
                  <p>
                    <span className="block text-muted-foreground">Follow-up</span>
                    <span
                      className={`mt-0.5 block font-semibold ${item.followUpDate < today ? 'text-destructive' : 'text-foreground'}`}
                    >
                      {item.followUpDate}
                      {item.followUpDate < today ? ' · Overdue' : ''}
                    </span>
                  </p>
                )}
              </div>
              <ApplicationActionPanels
                edit={
                  <ActionForm
                    action={saveApplicationAction}
                    submitLabel="Save application"
                    showSuccess={false}
                    successConfirmation="Updated"
                    className="grid gap-3 rounded-xl border bg-muted/20 p-4"
                  >
                    <input type="hidden" name="id" value={item.id} />
                    <label className={label}>
                      Company
                      <input
                        name="company"
                        defaultValue={item.company}
                        required
                        className={field}
                      />
                    </label>
                    <label className={label}>
                      Role title
                      <input
                        name="roleTitle"
                        defaultValue={item.roleTitle}
                        required
                        className={field}
                      />
                    </label>
                    <label className={label}>
                      Track
                      <select name="roleTrack" defaultValue={item.roleTrack} className={field}>
                        <option>SE</option>
                        <option>AI</option>
                        <option>DevOps</option>
                        <option>QA</option>
                        <option>Other</option>
                      </select>
                    </label>
                    <label className={label}>
                      URL
                      <input
                        type="url"
                        name="url"
                        defaultValue={item.url ?? ''}
                        className={field}
                      />
                    </label>
                    <label className={label}>
                      Location
                      <input name="location" defaultValue={item.location ?? ''} className={field} />
                    </label>
                    <label className={label}>
                      Arrangement
                      <select
                        name="arrangement"
                        defaultValue={item.arrangement ?? ''}
                        className={field}
                      >
                        <option value="">Unspecified</option>
                        <option value="onsite">On site</option>
                        <option value="hybrid">Hybrid</option>
                        <option value="remote">Remote</option>
                      </select>
                    </label>
                    <label className={label}>
                      Application date
                      <input
                        type="date"
                        name="appliedOn"
                        defaultValue={item.appliedOn ?? ''}
                        max={today}
                        className={field}
                      />
                    </label>
                    <label className={label}>
                      Follow-up date
                      <input
                        type="date"
                        name="followUpDate"
                        defaultValue={item.followUpDate ?? ''}
                        className={field}
                      />
                    </label>
                    <label className={label}>
                      Contact name
                      <input
                        name="contactName"
                        defaultValue={item.contactName ?? ''}
                        className={field}
                      />
                    </label>
                    <label className={label}>
                      Note
                      <input name="note" defaultValue={item.note ?? ''} className={field} />
                    </label>
                  </ActionForm>
                }
                stage={
                  <ActionForm
                    action={changeApplicationStageAction}
                    submitLabel="Record stage"
                    showSuccess={false}
                    successConfirmation="Stage recorded"
                    className="grid gap-3 rounded-xl border bg-muted/20 p-4"
                  >
                    <input type="hidden" name="id" value={item.id} />
                    <ApplicationStageFields
                      key={`${item.stage}-${item.appliedOn ?? ''}`}
                      options={stages.filter(([key]) => key !== 'saved' || !item.appliedOn)}
                      today={today}
                      mode="update"
                      initialStage={item.stage}
                      submittedOn={item.appliedOn}
                    />
                  </ActionForm>
                }
                history={
                  <ol className="space-y-2 rounded-xl border bg-muted/20 p-4 text-xs">
                    {history
                      .filter((event) => event.applicationId === item.id)
                      .map((event) => (
                        <li key={event.id} className="flex flex-wrap gap-x-2">
                          <span className="text-muted-foreground">
                            {event.toStage === 'applied' && item.appliedOn
                              ? `Stage date ${item.appliedOn}`
                              : event.stageOn
                                ? `Stage date ${event.stageOn}`
                                : `Recorded ${localDate(event.changedAt)}`}
                          </span>
                          <span className="font-medium">
                            {stageLabel(event.fromStage)} → {stageLabel(event.toStage)}
                          </span>
                        </li>
                      ))}
                  </ol>
                }
              />
              {item.followUpDate && !item.followUpTaskId && (
                <div className="mt-3">
                  <ActionForm
                    action={createApplicationFollowUpAction}
                    submitLabel="Create follow-up task"
                    showSuccess={false}
                    successConfirmation="Task created"
                  >
                    <input type="hidden" name="id" value={item.id} />
                  </ActionForm>
                </div>
              )}
              {item.followUpTaskId && (
                <p className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  Linked follow-up task created.
                </p>
              )}
            </article>
          ))}
          {!filteredApplications.length && (
            <p className="rounded-xl border border-dashed bg-muted/20 px-4 py-6 text-sm text-muted-foreground md:col-span-2">
              {applications.length
                ? 'No applications match this filter.'
                : 'Your saved opportunities will appear here.'}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
