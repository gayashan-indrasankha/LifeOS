'use client';

import { startTransition, useActionState, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { HabitCreateSchema, type HabitCreateInput } from '@/lib/validations/habit';
import type { HabitActionState } from '@/lib/actions/habit-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

const SCHEDULE_OPTIONS = [
  { value: 'custom:1111100', label: 'Selected weekdays' },
  { value: 'weekly:1', label: 'Once per week' },
  { value: 'weekly:2', label: 'Twice per week' },
  { value: 'weekly:3', label: 'Three times per week' },
  { value: 'weekly:4', label: 'Four times per week' },
  { value: 'weekly:5', label: 'Five times per week' },
  { value: 'weekly:6', label: 'Six times per week' },
  { value: 'weekly:7', label: 'Seven times per week' },
  { value: 'daily', label: 'Every day' },
  { value: 'weekdays', label: 'Weekdays only (Mon–Fri)' },
  { value: 'weekends', label: 'Weekends only (Sat–Sun)' },
];

const ICON_OPTIONS = [
  '💪',
  '🏃',
  '📚',
  '💧',
  '🧘',
  '🥗',
  '😴',
  '✍️',
  '🎵',
  '🧹',
  '💊',
  '🌿',
  '☀️',
  '🎯',
  '🧠',
  '❤️',
];

interface HabitFormProps {
  action: (prevState: HabitActionState, formData: FormData) => Promise<HabitActionState>;
  defaultValues?: Partial<HabitCreateInput>;
  defaultStartDate: string;
  effectiveDateDefault?: string;
}

const initialState: HabitActionState = {};

export function HabitForm({
  action,
  defaultValues,
  defaultStartDate,
  effectiveDateDefault,
}: HabitFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  const {
    register,
    formState: { errors },
    setValue,
    control,
    handleSubmit,
  } = useForm<HabitCreateInput>({
    resolver: zodResolver(HabitCreateSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      description: defaultValues?.description ?? '',
      icon: defaultValues?.icon ?? '',
      category: defaultValues?.category ?? '',
      monthlyTarget: defaultValues?.monthlyTarget ?? 20,
      schedule: defaultValues?.schedule ?? 'daily',
      startDate: defaultValues?.startDate ?? defaultStartDate,
      endDate: defaultValues?.endDate ?? '',
    },
  });

  const selectedSchedule =
    useWatch({ control, name: 'schedule' }) ?? defaultValues?.schedule ?? 'daily';
  const selectedIcon = useWatch({ control, name: 'icon' }) ?? defaultValues?.icon ?? '';
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <Card>
      <CardContent className="pt-6">
        <form
          ref={formRef}
          action={formAction}
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit(() =>
              startTransition(() => {
                if (formRef.current) formAction(new FormData(formRef.current));
              }),
            )(event);
          }}
          className="space-y-5"
        >
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name">
              Habit Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="e.g. Morning run, Read 20 pages"
              {...register('name')}
              aria-describedby={errors.name ? 'name-error' : undefined}
            />
            {(errors.name || state.fieldErrors?.name) && (
              <p id="name-error" className="text-sm text-destructive">
                {errors.name?.message ?? state.fieldErrors?.name?.[0]}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Optional notes about this habit…"
              rows={2}
              {...register('description')}
            />
            {(errors.description || state.fieldErrors?.description) && (
              <p role="alert" className="text-sm text-destructive">
                {errors.description?.message ?? state.fieldErrors?.description?.[0]}
              </p>
            )}
          </div>

          {/* Icon picker */}
          <div className="space-y-1.5">
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-2">
              {ICON_OPTIONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() =>
                    setValue('icon', icon, { shouldDirty: true, shouldValidate: true })
                  }
                  aria-label={`Select icon ${icon}`}
                  aria-pressed={selectedIcon === icon}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg border-2 text-lg transition-all ${
                    selectedIcon === icon
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {icon}
                </button>
              ))}
              {/* Clear button */}
              {selectedIcon && (
                <button
                  type="button"
                  onClick={() => setValue('icon', '', { shouldDirty: true, shouldValidate: true })}
                  className="h-9 rounded-lg border-2 border-border px-2 text-xs text-muted-foreground hover:border-destructive hover:text-destructive"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Label htmlFor="custom-icon" className="shrink-0 text-sm font-normal">
                Or use your own emoji
              </Label>
              <Input
                id="custom-icon"
                type="text"
                value={selectedIcon}
                onChange={(event) =>
                  setValue('icon', event.target.value, { shouldDirty: true, shouldValidate: true })
                }
                onFocus={(event) => event.currentTarget.select()}
                maxLength={50}
                autoComplete="off"
                spellCheck={false}
                placeholder="😊"
                aria-describedby="custom-icon-help"
                className="h-11 w-24 text-center text-xl"
              />
              <p id="custom-icon-help" className="text-xs text-muted-foreground">
                Type or paste an emoji from your keyboard.
              </p>
            </div>
            {(errors.icon || state.fieldErrors?.icon) && (
              <p role="alert" className="text-sm text-destructive">
                {errors.icon?.message ?? state.fieldErrors?.icon?.[0]}
              </p>
            )}
            <input type="hidden" {...register('icon')} />
          </div>

          {/* Category + Monthly Target */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="category">Category</Label>
              <Input id="category" placeholder="e.g. Health, Learning" {...register('category')} />
              {(errors.category || state.fieldErrors?.category) && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.category?.message ?? state.fieldErrors?.category?.[0]}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="monthlyTarget">
                Monthly Target <span className="text-destructive">*</span>
              </Label>
              <Input
                id="monthlyTarget"
                type="number"
                min={1}
                max={31}
                {...register('monthlyTarget', { valueAsNumber: true })}
                aria-describedby={errors.monthlyTarget ? 'target-error' : undefined}
              />
              {(errors.monthlyTarget || state.fieldErrors?.monthlyTarget) && (
                <p id="target-error" className="text-sm text-destructive">
                  {errors.monthlyTarget?.message ?? state.fieldErrors?.monthlyTarget?.[0]}
                </p>
              )}
            </div>
          </div>

          {/* Schedule */}
          <div className="space-y-1.5">
            <Label htmlFor="schedule">Schedule</Label>
            <Select
              value={selectedSchedule.startsWith('custom:') ? 'custom:1111100' : selectedSchedule}
              onValueChange={(v) => setValue('schedule', v, { shouldValidate: true })}
            >
              <SelectTrigger id="schedule">
                <SelectValue placeholder="Select schedule" />
              </SelectTrigger>
              <SelectContent>
                {SCHEDULE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedSchedule.startsWith('custom:') && (
              <div
                className="flex flex-wrap gap-2 pt-2"
                role="group"
                aria-label="Scheduled weekdays"
              >
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, index) => (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={selectedSchedule[7 + index] === '1'}
                    className={`rounded-md border px-3 py-1.5 text-sm ${selectedSchedule[7 + index] === '1' ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground'}`}
                    onClick={() => {
                      const bits = selectedSchedule.slice(7).split('');
                      bits[index] = bits[index] === '1' ? '0' : '1';
                      setValue('schedule', `custom:${bits.join('')}`, { shouldValidate: true });
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            {errors.schedule && (
              <p className="text-sm text-destructive">{errors.schedule.message}</p>
            )}
            <input type="hidden" {...register('schedule')} value={selectedSchedule} />
          </div>

          {/* Start Date */}
          <div className="space-y-1.5">
            <Label htmlFor="startDate">Start Date</Label>
            <Input
              id="startDate"
              type="date"
              {...register('startDate')}
              aria-describedby={errors.startDate ? 'start-date-error' : undefined}
            />
            {errors.startDate && (
              <p id="start-date-error" className="text-sm text-destructive">
                {errors.startDate.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="endDate">End Date (optional)</Label>
            <Input id="endDate" type="date" {...register('endDate')} />
            {(errors.endDate || state.fieldErrors?.endDate) && (
              <p className="text-sm text-destructive">
                {errors.endDate?.message ?? state.fieldErrors?.endDate?.[0]}
              </p>
            )}
          </div>

          {effectiveDateDefault && (
            <div className="space-y-1.5">
              <Label htmlFor="effectiveDate">Apply schedule changes from</Label>
              <Input
                id="effectiveDate"
                name="effectiveDate"
                type="date"
                min={effectiveDateDefault}
                defaultValue={effectiveDateDefault}
                required
              />
              <p className="text-xs text-muted-foreground">
                Earlier schedule and completed days stay in history.
              </p>
              {state.fieldErrors?.effectiveDate && (
                <p role="alert" className="text-sm text-destructive">
                  {state.fieldErrors.effectiveDate[0]}
                </p>
              )}
            </div>
          )}

          {/* Server error */}
          {state.error && (
            <div
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {state.error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Habit
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
