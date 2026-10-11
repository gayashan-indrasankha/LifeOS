import { ChevronDown, Plus, UtensilsCrossed } from 'lucide-react';
import type { mealTemplates } from '@/lib/db/schema';
import { saveMealTemplateAction, setNutritionEnabledAction } from '@/lib/actions/nutrition-actions';
import { ActionForm } from '@/components/life/action-form';

type Meal = typeof mealTemplates.$inferSelect;

function MealEditor({ meal }: { meal: Meal | null }) {
  return (
    <ActionForm
      action={saveMealTemplateAction}
      submitLabel={meal ? 'Save meal' : 'Add meal'}
      className="grid gap-3 border-t bg-card p-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <input type="hidden" name="id" value={meal?.id ?? ''} />
      <label className="text-sm font-medium sm:col-span-1 lg:col-span-2">
        Meal name
        <input
          name="name"
          required
          maxLength={100}
          defaultValue={meal?.name ?? ''}
          placeholder="Breakfast"
          className="mt-1.5 min-h-11 w-full rounded-lg border bg-background px-3 font-normal"
        />
      </label>
      <label className="text-sm font-medium sm:col-span-1 lg:col-span-2">
        Preferred time (optional)
        <input
          name="preferredTime"
          type="time"
          defaultValue={meal?.preferredTime ?? ''}
          className="mt-1.5 min-h-11 w-full rounded-lg border bg-background px-3 font-normal"
        />
      </label>
      <label className="text-sm font-medium sm:col-span-2 lg:col-span-4">
        Food/portion notes (optional)
        <textarea
          name="notes"
          rows={2}
          maxLength={500}
          defaultValue={meal?.notes ?? ''}
          className="mt-1.5 w-full rounded-lg border bg-background p-3 font-normal"
        />
      </label>
      <label className="text-sm font-medium">
        Planned kcal (optional)
        <input
          name="plannedCalories"
          type="number"
          min={0}
          max={6000}
          defaultValue={meal?.plannedCalories ?? ''}
          className="mt-1.5 min-h-11 w-full rounded-lg border bg-background px-3 font-normal"
        />
      </label>
      <label className="text-sm font-medium">
        Planned protein g (optional)
        <input
          name="plannedProtein"
          type="number"
          min={0}
          max={400}
          defaultValue={meal?.plannedProtein ?? ''}
          className="mt-1.5 min-h-11 w-full rounded-lg border bg-background px-3 font-normal"
        />
      </label>
      <label className="text-sm font-medium">
        Planned carbs g (optional)
        <input
          name="plannedCarbs"
          type="number"
          min={0}
          max={1000}
          defaultValue={meal?.plannedCarbs ?? ''}
          className="mt-1.5 min-h-11 w-full rounded-lg border bg-background px-3 font-normal"
        />
      </label>
      <label className="text-sm font-medium">
        Planned fat g (optional)
        <input
          name="plannedFat"
          type="number"
          min={0}
          max={500}
          defaultValue={meal?.plannedFat ?? ''}
          className="mt-1.5 min-h-11 w-full rounded-lg border bg-background px-3 font-normal"
        />
      </label>
      <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2 lg:col-span-4">
        <input type="checkbox" name="active" defaultChecked={meal?.active ?? true} />
        Active in Today checklist
      </label>
    </ActionForm>
  );
}

export function NutritionSettings({ enabled, meals }: { enabled: boolean; meals: Meal[] }) {
  return (
    <section
      aria-label="Optional meal checklist"
      className="overflow-hidden rounded-2xl border bg-card shadow-sm"
    >
      <div className="android-nutrition-header flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
        <div className="android-copy-intro flex min-w-0 flex-1 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <UtensilsCrossed aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">Optional meal checklist</h2>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}
              >
                {enabled ? 'On' : 'Paused'}
              </span>
            </div>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              <span className="android-standard-copy">
                Plan a few meals here. On Today, mark whether you ate each meal as planned or ate
                something else. You can leave that question unanswered and enter actual amounts
                separately on Today. Planned nutrition values are references, not amounts you ate.
              </span>
              <span className="android-mobile-copy">
                Plan meals here, then mark each one as planned, changed, or missed on Today. Log
                actual amounts separately when you have them; planned values are only a guide.
              </span>
            </p>
          </div>
        </div>
        <ActionForm
          action={setNutritionEnabledAction}
          submitLabel={enabled ? 'Pause checklist' : 'Enable checklist'}
          buttonVariant={enabled ? 'secondary' : 'primary'}
          className="shrink-0"
        >
          <input type="hidden" name="enabled" value={String(!enabled)} />
        </ActionForm>
      </div>

      <details className="group/plan border-t">
        <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/30 sm:px-6 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-primary">
              Edit meal plan ({meals.length}/6)
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Open a meal to change its details.
            </span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className="h-5 w-5 shrink-0 text-primary transition-transform group-open/plan:rotate-180"
          />
        </summary>
        <div className="space-y-3 bg-muted/20 px-4 pb-5 pt-1 sm:px-6">
          {meals.map((meal, index) => {
            const plan = [
              meal.plannedCalories == null ? null : `${meal.plannedCalories} kcal`,
              meal.plannedProtein == null ? null : `${meal.plannedProtein} g protein`,
              meal.plannedCarbs == null ? null : `${meal.plannedCarbs} g carbs`,
              meal.plannedFat == null ? null : `${meal.plannedFat} g fat`,
            ].filter(Boolean);

            return (
              <details
                key={meal.id}
                name="meal-editor"
                className="group/meal overflow-hidden rounded-xl border bg-card"
              >
                <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-4 py-3 transition-colors hover:bg-primary/5 [&::-webkit-details-marker]:hidden">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold tabular-nums text-primary">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{meal.name}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {meal.preferredTime ?? 'No time planned'}
                      {plan.length > 0 ? ` · ${plan.join(' · ')}` : ''}
                    </span>
                  </span>
                  <span className="hidden rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground sm:inline-block">
                    {meal.active ? 'In Today' : 'Paused'}
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open/meal:rotate-180"
                  />
                </summary>
                <MealEditor meal={meal} />
              </details>
            );
          })}

          {meals.length < 6 && (
            <details
              name="meal-editor"
              open={meals.length === 0}
              className="group/new-meal overflow-hidden rounded-xl border border-dashed bg-card"
            >
              <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 font-semibold text-primary transition-colors hover:bg-primary/5 [&::-webkit-details-marker]:hidden">
                <Plus aria-hidden="true" className="h-5 w-5" />
                <span className="min-w-0 flex-1">Add another meal</span>
                <ChevronDown
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 transition-transform group-open/new-meal:rotate-180"
                />
              </summary>
              <MealEditor meal={null} />
            </details>
          )}
        </div>
      </details>
    </section>
  );
}
