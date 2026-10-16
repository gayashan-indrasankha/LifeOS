'use client';

import { useState, useTransition } from 'react';
import { ChevronDown, UtensilsCrossed } from 'lucide-react';
import { saveMealActualAction, setMealStatusAction } from '@/lib/actions/nutrition-actions';
import {
  dailyActualTotals,
  dailyMealPlanTotals,
  type ActualMealAmounts,
  type MealStatus,
} from '@/lib/nutrition/summary';

type Meal = {
  id: string;
  name: string;
  notes: string | null;
  preferredTime: string | null;
  plannedCalories: number | null;
  plannedProtein: number | null;
  plannedCarbs: number | null;
  plannedFat: number | null;
  active: boolean;
};

export function MealChecklist({
  date,
  meals,
  initialStatuses,
  initialActuals,
  summary,
}: {
  date: string;
  meals: Meal[];
  initialStatuses: Record<string, MealStatus>;
  initialActuals: Record<string, ActualMealAmounts>;
  summary: {
    recordedDays: number;
    followedItems: number;
    notFollowedItems: number;
    missedItems: number;
    unrecordedDays: number;
  };
}) {
  const [statuses, setStatuses] = useState(initialStatuses);
  const [actuals, setActuals] = useState(initialActuals);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const [previousInitialStatuses, setPreviousInitialStatuses] = useState(initialStatuses);
  const [previousInitialActuals, setPreviousInitialActuals] = useState(initialActuals);
  if (initialStatuses !== previousInitialStatuses) {
    setPreviousInitialStatuses(initialStatuses);
    if (pendingId === null) setStatuses(initialStatuses);
  }
  if (initialActuals !== previousInitialActuals) {
    setPreviousInitialActuals(initialActuals);
    if (pendingId === null) setActuals(initialActuals);
  }
  const plannedTotals = dailyMealPlanTotals(meals);
  const actualTotals = dailyActualTotals(Object.values(actuals));
  const mealsWithAmounts = Object.values(actuals).filter((amounts) =>
    Object.values(amounts).some((value) => value != null),
  ).length;

  function saveActual(id: string, form: FormData) {
    setPendingId(id);
    setSavedId(null);
    setError('');
    startTransition(async () => {
      try {
        const result = await saveMealActualAction(id, date, form);
        if (result.error) {
          setError(result.error);
          return;
        }
        const read = (name: string) => {
          const value = form.get(name);
          return typeof value === 'string' && value !== '' ? Number(value) : null;
        };
        setActuals((current) => ({
          ...current,
          [id]: {
            actualCalories: read('actualCalories'),
            actualProtein: read('actualProtein'),
            actualCarbs: read('actualCarbs'),
            actualFat: read('actualFat'),
          },
        }));
        setSavedId(id);
      } catch {
        setError('Could not save actual amounts. Try again.');
      } finally {
        setPendingId(null);
      }
    });
  }

  function record(id: string, status: MealStatus | 'not_recorded') {
    setPendingId(id);
    setError('');
    startTransition(async () => {
      try {
        const result = await setMealStatusAction(id, date, status);
        if (result.error) {
          setError(result.error);
          return;
        }
        setStatuses((current) => {
          const next = { ...current };
          if (status === 'not_recorded') delete next[id];
          else next[id] = status;
          return next;
        });
      } catch {
        setError('Could not save this meal. Try again.');
      } finally {
        setPendingId(null);
      }
    });
  }

  return (
    <details className="group/nutrition overflow-hidden rounded-2xl border bg-card shadow-sm">
      <summary className="flex min-h-20 cursor-pointer list-none items-center gap-3 px-4 py-4 transition-colors hover:bg-muted/30 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <UtensilsCrossed aria-hidden="true" className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold tracking-tight">Nutrition checklist</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Optional
            </span>
          </span>
          <span className="mt-0.5 block text-sm text-muted-foreground">
            {meals.length} {meals.length === 1 ? 'meal' : 'meals'} · {mealsWithAmounts} with amounts
            logged
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open/nutrition:rotate-180"
        />
      </summary>

      <div className="space-y-5 border-t px-4 py-5 sm:px-5">
        {(plannedTotals.items.some((item) => item.entered > 0) ||
          actualTotals.some((item) => item.entered > 0)) && (
          <section
            aria-label="Daily nutrition totals"
            className="rounded-xl border bg-muted/30 p-4"
          >
            <h3 className="font-semibold">Daily nutrition totals</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              <span className="android-standard-copy">
                Actual amounts are added only when you enter them. Plans use active meals with
                values.
              </span>
              <span className="android-mobile-copy">
                Totals include only the amounts you log, with planned values shown for reference.
              </span>
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
              {plannedTotals.items.map((item, index) => (
                <div key={item.label} className="min-w-0 rounded-lg border bg-card p-3">
                  <p className="text-xs font-semibold text-muted-foreground">{item.label}</p>
                  {actualTotals[index].entered ? (
                    <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
                      {actualTotals[index].total} {item.unit} consumed
                    </p>
                  ) : (
                    <p className="mt-1 text-sm font-medium text-muted-foreground">Not logged yet</p>
                  )}
                  {actualTotals[index].entered > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      From {actualTotals[index].entered}{' '}
                      {actualTotals[index].entered === 1 ? 'meal' : 'meals'}
                    </p>
                  )}
                  <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">
                    Plan: {item.entered ? `${item.total} ${item.unit}` : 'not set'}
                  </p>
                  {item.entered > 0 && item.entered < plannedTotals.mealCount && (
                    <p className="text-[11px] text-muted-foreground">
                      Plan covers {item.entered} of {plannedTotals.mealCount} meals
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {meals.length === 0 && (
          <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
            Add meals in Settings to start this optional checklist.
          </p>
        )}

        <div className="space-y-3">
          {meals.map((meal, index) => {
            const actual = actuals[meal.id];
            const hasAmounts = actual && Object.values(actual).some((value) => value != null);
            const planned = [
              meal.plannedCalories == null ? null : `~${meal.plannedCalories} kcal`,
              meal.plannedProtein == null ? null : `~${meal.plannedProtein} g protein`,
              meal.plannedCarbs == null ? null : `~${meal.plannedCarbs} g carbs`,
              meal.plannedFat == null ? null : `~${meal.plannedFat} g fat`,
            ].filter(Boolean);
            const actualPreview = actual
              ? [
                  actual.actualCalories == null ? null : `${actual.actualCalories} kcal`,
                  actual.actualProtein == null ? null : `${actual.actualProtein} g protein`,
                  actual.actualCarbs == null ? null : `${actual.actualCarbs} g carbs`,
                  actual.actualFat == null ? null : `${actual.actualFat} g fat`,
                ].filter(Boolean)
              : [];

            return (
              <article key={meal.id} className="rounded-xl border bg-card p-4 text-sm shadow-sm">
                <div className="android-meal-heading flex flex-wrap items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold tabular-nums text-primary">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold">{meal.name}</h3>
                    {meal.notes && (
                      <p className="mt-0.5 whitespace-pre-wrap break-words text-xs text-muted-foreground">
                        {meal.notes}
                      </p>
                    )}
                  </div>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                    {meal.preferredTime ?? 'No time planned'}
                  </span>
                </div>

                {planned.length > 0 && (
                  <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
                    Plan reference: {planned.join(' · ')}.
                  </p>
                )}

                <details className="group/amounts mt-3 overflow-hidden rounded-lg border bg-muted/20">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-3 py-2 transition-colors hover:bg-primary/5 [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-primary">
                        {hasAmounts ? 'Edit actual amounts' : 'Add actual amounts'}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {hasAmounts
                          ? actualPreview.join(' · ')
                          : 'Calories, protein, carbs and fat'}
                      </span>
                    </span>
                    <ChevronDown
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-primary transition-transform group-open/amounts:rotate-180"
                    />
                  </summary>
                  <form
                    aria-label={`Actual amounts for ${meal.name} on ${date}`}
                    className="border-t bg-card p-3 sm:p-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      saveActual(meal.id, new FormData(event.currentTarget));
                    }}
                  >
                    <p className="text-sm font-semibold">What did you consume?</p>
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {(
                        [
                          ['actualCalories', 'Calories (kcal)', meal.plannedCalories],
                          ['actualProtein', 'Protein (g)', meal.plannedProtein],
                          ['actualCarbs', 'Carbs (g)', meal.plannedCarbs],
                          ['actualFat', 'Fat (g)', meal.plannedFat],
                        ] as const
                      ).map(([name, label, plannedAmount]) => (
                        <label key={name} className="text-xs font-semibold">
                          {label}
                          <input
                            name={name}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={
                              name === 'actualCalories'
                                ? 6000
                                : name === 'actualProtein'
                                  ? 400
                                  : name === 'actualCarbs'
                                    ? 1000
                                    : 500
                            }
                            defaultValue={initialActuals[meal.id]?.[name] ?? ''}
                            placeholder="Leave blank"
                            className="mt-1.5 min-h-11 w-full rounded-lg border bg-background px-3 text-sm font-normal"
                          />
                          <span className="mt-1 block font-normal text-muted-foreground">
                            Plan:{' '}
                            {plannedAmount == null
                              ? 'not set'
                              : `${plannedAmount} ${name === 'actualCalories' ? 'kcal' : 'g'}`}
                          </span>
                        </label>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                      <button
                        type="submit"
                        disabled={pending && pendingId === meal.id}
                        className="min-h-10 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                      >
                        Save actual amounts
                      </button>
                      {savedId === meal.id && (
                        <span className="text-xs font-medium text-primary" role="status">
                          Saved
                        </span>
                      )}
                    </div>
                  </form>
                </details>

                <div
                  className="mt-4 border-t pt-3"
                  role="group"
                  aria-label={`Did you eat ${meal.name} as planned on ${date}?`}
                >
                  <p className="text-xs font-semibold">Did this meal match your plan?</p>
                  <div className="android-meal-choices mt-2 flex flex-wrap gap-2">
                    {(['followed', 'not_followed', 'missed'] as const).map((status) => (
                      <button
                        key={status}
                        type="button"
                        disabled={pending && pendingId === meal.id}
                        aria-pressed={statuses[meal.id] === status}
                        onClick={() => record(meal.id, status)}
                        className={`min-h-10 rounded-lg border px-3 text-xs font-medium transition-colors disabled:opacity-60 ${statuses[meal.id] === status ? 'border-primary bg-primary/10 text-primary' : 'bg-muted/30 text-foreground hover:border-primary/40 hover:bg-primary/5'}`}
                      >
                        {status === 'followed'
                          ? 'Ate as planned'
                          : status === 'not_followed'
                            ? 'Ate something else'
                            : 'Missed Meal'}
                      </button>
                    ))}
                  </div>
                  {statuses[meal.id] && (
                    <button
                      type="button"
                      disabled={pending && pendingId === meal.id}
                      onClick={() => record(meal.id, 'not_recorded')}
                      className="mt-2 min-h-9 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-primary hover:underline disabled:opacity-60"
                    >
                      Clear choice
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <div className="rounded-xl bg-muted/40 p-4">
          <p className="text-xs font-semibold text-foreground">This week</p>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
            <span>{summary.recordedDays} days logged</span>
            <span>{summary.followedItems} meals as planned</span>
            <span>{summary.notFollowedItems} meals changed</span>
            <span>{summary.missedItems} meals missed</span>
            <span>{summary.unrecordedDays} days not logged</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            <span className="android-standard-copy">
              This tracks meal choices separately from the actual amounts you enter.
            </span>
            <span className="android-mobile-copy">
              Meal choices and actual amounts are tracked separately.
            </span>
          </p>
        </div>
      </div>
    </details>
  );
}
