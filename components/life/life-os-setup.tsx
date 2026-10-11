'use client';

import { useActionState, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { applyLifeTemplateAction, previewLifeTemplateAction } from '@/lib/actions/template-actions';
import type { LifeActionState } from '@/lib/actions/life-actions';
import { sectionLabels } from '@/lib/life-os/preset';
import type { Plan } from '@/lib/life-os/install';

const sectionDetails: Record<keyof typeof sectionLabels, string> = {
  university: 'An education goal, five editable subjects, starter tasks and a study habit.',
  industry: 'A project goal and milestones you can assign to days in Week.',
  career: 'Software Engineering and DevOps goals, projects and milestones.',
  interview: 'SE and DevOps topic starters for recording real practice in Evidence.',
  english: 'A speaking goal and habit; record actual practice in Evidence.',
  fitness: 'A weight goal and gym and weigh-in habits; record measurements on Today.',
  nutrition: 'Six blank meal slots to plan in Settings and log on Today.',
  recovery: 'Reading, meditation, sleep and attention routines.',
};

export function LifeOsSetup() {
  const formRef = useRef<HTMLFormElement>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [installedNeedsInput, setInstalledNeedsInput] = useState<string[]>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [state, installAction, installing] = useActionState(
    async (previous: LifeActionState, form: FormData) => {
      const outcome = await applyLifeTemplateAction(previous, form);
      if (outcome.success) {
        setInstalledNeedsInput(plan?.needsInput ?? []);
        setPlan(null);
      }
      return outcome;
    },
    {},
  );

  function preview() {
    const form = formRef.current;
    if (!form) return;
    const confirmation = form.elements.namedItem('confirm');
    if (confirmation instanceof HTMLInputElement) confirmation.required = false;
    const valid = form.reportValidity();
    if (confirmation instanceof HTMLInputElement) confirmation.required = true;
    if (!valid) return;
    const data = new FormData(form);
    startTransition(async () => {
      const result = await previewLifeTemplateAction(data);
      setPlan(result.plan ?? null);
      setPreviewError(result.error ?? null);
    });
  }

  const grouped = plan
    ? Object.entries(sectionLabels)
        .map(([section, label]) => ({
          section,
          label,
          items: plan.items.filter((item) => item.section === section),
        }))
        .filter((group) => group.items.length)
    : [];
  const count = (status: string) =>
    plan?.items.filter((item) => item.status === status).length ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">Optional setup</p>
        <h1 className="text-3xl font-bold tracking-tight">Set up my LifeOS</h1>
        <p className="text-sm font-semibold">Preset: Personal plan</p>
        <p className="text-sm text-muted-foreground">
          Choose sections, preview the starter goals, tasks and habits, then install. Add real
          dates, meals and measurements as you go. Existing and customized records remain intact.
        </p>
        <p className="text-sm text-muted-foreground">
          Monthly insights builds from your recorded activity, so setup does not create a review or
          any completed entries.
        </p>
      </header>
      <form
        ref={formRef}
        action={installAction}
        onChange={(event) => {
          if (!(event.target instanceof HTMLInputElement) || event.target.name !== 'confirm') {
            setPlan(null);
            setPreviewError(null);
          }
        }}
        className="space-y-6"
      >
        <section className="rounded-2xl border bg-card p-5 space-y-4">
          <h2 className="text-xl font-semibold">Choose sections</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {(Object.entries(sectionLabels) as [keyof typeof sectionLabels, string][]).map(
              ([value, label]) => (
                <label
                  key={value}
                  className="flex cursor-pointer gap-3 rounded-xl border p-4 focus-within:ring-2 focus-within:ring-primary"
                >
                  <input
                    type="checkbox"
                    name="section"
                    value={value}
                    defaultChecked
                    className="mt-1 h-5 w-5 accent-primary"
                  />
                  <span>
                    <strong className="block">{label}</strong>
                    <span className="text-sm text-muted-foreground">{sectionDetails[value]}</span>
                  </span>
                </label>
              ),
            )}
          </div>
          <button
            type="button"
            onClick={preview}
            disabled={pending}
            className="min-h-11 rounded-lg bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-60"
          >
            {pending ? 'Checking...' : 'Preview changes'}
          </button>
          {previewError && (
            <p role="alert" className="text-sm text-destructive">
              {previewError}
            </p>
          )}
        </section>
        {plan && (
          <section className="rounded-2xl border bg-card p-5 space-y-5" aria-label="Setup preview">
            <div>
              <h2 className="text-xl font-semibold">Review proposed changes</h2>
              <p className="text-sm text-muted-foreground">
                Starting {plan.today}. Preview is read only and checks your current records.
                Installation checks again inside a transaction.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm" aria-label="Preview counts">
              <span className="rounded-full bg-primary/10 px-3 py-1">{count('new')} new</span>
              <span className="rounded-full bg-muted px-3 py-1">{count('existing')} existing</span>
              <span className="rounded-full bg-muted px-3 py-1">
                {count('archived') + count('deleted')} archived or removed
              </span>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-900 dark:bg-amber-900 dark:text-amber-100">
                {count('duplicate') + count('conflict')} needs review
              </span>
            </div>
            {grouped.map((group) => (
              <details
                key={group.section}
                className="rounded-xl border"
                open={group.items.some((item) => item.status === 'conflict')}
              >
                <summary className="cursor-pointer p-4 font-semibold">
                  {group.label}{' '}
                  <span className="font-normal text-muted-foreground">({group.items.length})</span>
                </summary>
                <ul className="divide-y border-t">
                  {group.items.map((item) => (
                    <li
                      key={item.type + item.key}
                      className="flex flex-col gap-1 p-3 text-sm sm:flex-row sm:justify-between sm:gap-4"
                    >
                      <span>
                        <strong>{item.name}</strong>
                        <span className="block text-muted-foreground">
                          {item.type} · {item.detail}
                        </span>
                        {item.reason && (
                          <span className="block text-muted-foreground">{item.reason}</span>
                        )}
                      </span>
                      <span className="shrink-0 capitalize font-semibold">{item.status}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
            <div className="rounded-xl bg-muted/40 p-4">
              <h3 className="font-semibold">Complete later with your own details</h3>
              <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
                {plan.needsInput.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                name="confirm"
                value="yes"
                required
                className="mt-1 h-5 w-5 accent-primary"
              />
              <span>
                I reviewed this preview and want to add the new items in my selected sections.
                Existing, archived, removed, duplicate and conflicting items will be kept as shown.
              </span>
            </label>
            <button
              type="submit"
              disabled={installing}
              className="min-h-11 rounded-lg bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-60"
            >
              {installing ? 'Installing...' : 'Install selected setup'}
            </button>
          </section>
        )}
        {state.error && (
          <p
            role="alert"
            className="rounded-xl border border-destructive p-4 text-sm text-destructive"
          >
            {state.error}
          </p>
        )}
        {state.success && (
          <div role="status" className="rounded-xl border p-4 text-sm space-y-3">
            <h2 className="text-lg font-semibold">Your plan is ready to use</h2>
            <p>{state.success}</p>
            <p>
              Start in Week by assigning starter tasks to days. On Today, choose priorities and
              record habits, meals and weight as they happen.
            </p>
            <Link
              href="/today"
              className="inline-flex min-h-10 items-center rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground"
            >
              Open Today
            </Link>
            {installedNeedsInput.length > 0 && (
              <details className="rounded-lg border p-3">
                <summary className="cursor-pointer font-semibold">
                  Personalize later ({installedNeedsInput.length})
                </summary>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                  {installedNeedsInput.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </details>
            )}
            <p className="text-xs text-muted-foreground">
              You can use the plan now. Add real subjects, deadlines, and quantities when you know
              them.
            </p>
          </div>
        )}
      </form>
    </div>
  );
}
