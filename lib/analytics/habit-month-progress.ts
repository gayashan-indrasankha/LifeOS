export type CalendarDay = {
  date: string;
  day: number;
  weekday: string;
  dayOfWeek: number;
};

export type DatedHabit = {
  schedule: string;
  startDate: string;
  endDate?: string | null;
  archived?: boolean;
  scheduleRevisions?: {
    effectiveDate: string;
    schedule: string;
    startDate: string;
    endDate: string | null;
    status: string;
  }[];
};

/** A missing rule before a legacy baseline means the old schedule is unknown. */
export function habitRuleOn(habit: DatedHabit, date: string) {
  if (habit.scheduleRevisions) {
    let latest: (typeof habit.scheduleRevisions)[number] | null = null;
    for (const revision of habit.scheduleRevisions) {
      if (
        revision.effectiveDate <= date &&
        (!latest || revision.effectiveDate > latest.effectiveDate)
      )
        latest = revision;
    }
    return latest;
  }
  return {
    ...habit,
    effectiveDate: habit.startDate,
    status: habit.archived ? 'archived' : 'active',
  };
}

export function isHabitActiveOn(habit: DatedHabit, date: string) {
  const rule = habitRuleOn(habit, date);
  return Boolean(rule && rule.status === 'active' && inHabitRange(rule, date));
}

export function isFlexibleHabitOn(habit: DatedHabit, date: string) {
  const rule = habitRuleOn(habit, date);
  return Boolean(
    rule && rule.status === 'active' && inHabitRange(rule, date) && isFlexibleWeekly(rule.schedule),
  );
}

export function isScheduledWeekday(schedule: string, dayOfWeek: number): boolean {
  if (/^weekly:[1-7]$/.test(schedule)) return true;
  if (schedule === 'daily') return true;
  if (schedule === 'weekdays') return dayOfWeek >= 1 && dayOfWeek <= 5;
  if (schedule === 'weekends') return dayOfWeek === 0 || dayOfWeek === 6;
  if (/^custom:[01]{7}$/.test(schedule)) {
    const index = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    return schedule[7 + index] === '1';
  }
  return false;
}

export function isFlexibleWeekly(schedule: string): boolean {
  return /^weekly:[1-7]$/.test(schedule);
}

export function isFixedOccurrence(habit: DatedHabit, date: string, dayOfWeek: number): boolean {
  const rule = habitRuleOn(habit, date);
  return (
    rule !== null &&
    rule.status === 'active' &&
    inHabitRange(rule, date) &&
    !isFlexibleWeekly(rule.schedule) &&
    isScheduledWeekday(rule.schedule, dayOfWeek)
  );
}

export function weeklyQuotaAttainment(
  habit: DatedHabit,
  firstDay: string,
  completedDates: ReadonlySet<string>,
  cutoff: string,
  startsOn = 1,
) {
  const rule = habitRuleOn(habit, cutoff);
  if (!rule || !isFlexibleWeekly(rule.schedule)) return { goal: 0, completed: 0, achieved: false };
  const quota = Number(rule.schedule.split(':')[1]);
  const start = weekStart(firstDay, startsOn);
  const [y, m, d] = start.split('-').map(Number);
  const eligible = Array.from({ length: 7 }, (_, offset) =>
    new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10),
  ).filter((date) => isFlexibleHabitOn(habit, date));
  const goal = Math.min(quota, eligible.length);
  const completed = eligible.filter((date) => date <= cutoff && completedDates.has(date)).length;
  return { goal, completed, achieved: goal > 0 && completed >= goal };
}

export function inHabitRange(
  habit: { startDate: string; endDate?: string | null },
  date: string,
): boolean {
  return date >= habit.startDate && (!habit.endDate || date <= habit.endDate);
}

export function weekStart(date: string, startsOn = 1): string {
  const [year, month, day] = date.split('-').map(Number);
  const current = new Date(Date.UTC(year, month - 1, day));
  current.setUTCDate(current.getUTCDate() - ((current.getUTCDay() - startsOn + 7) % 7));
  return current.toISOString().slice(0, 10);
}

export function scheduleStats(
  habit: DatedHabit,
  days: readonly CalendarDay[],
  completedDates: ReadonlySet<string>,
  cutoff: string,
  startsOn = 1,
) {
  // Month percentages are defined only for fixed occurrences. A calendar month
  // cuts flexible weeks in half, so weekly quota attainment is shown separately.
  void startsOn;
  const eligible = days.filter((day) => {
    if (day.date > cutoff) return false;
    if (isFixedOccurrence(habit, day.date, day.dayOfWeek)) return true;
    // A legacy check-in can predate the first recorded schedule revision.
    // Credit that recorded day without assuming any missed obligations nearby.
    if (!completedDates.has(day.date) || !habit.scheduleRevisions?.length) return false;
    if (habitRuleOn(habit, day.date) || isFlexibleWeekly(habit.schedule)) return false;
    const firstRule = habit.scheduleRevisions.reduce((first, rule) =>
      rule.effectiveDate < first.effectiveDate ? rule : first,
    );
    return inHabitRange(firstRule, day.date);
  });
  return {
    total: eligible.length,
    completed: eligible.filter((day) => completedDates.has(day.date)).length,
  };
}

export function isGridApplicable(
  habit: DatedHabit,
  day: CalendarDay,
  days: readonly CalendarDay[],
  completedDates: ReadonlySet<string>,
  startsOn = 1,
): boolean {
  void days;
  void completedDates;
  void startsOn;
  const rule = habitRuleOn(habit, day.date);
  return Boolean(
    rule &&
    rule.status === 'active' &&
    inHabitRange(rule, day.date) &&
    isScheduledWeekday(rule.schedule, day.dayOfWeek),
  );
}

export function habitMonthProgress(
  habit: DatedHabit & { monthlyTarget: number },
  days: CalendarDay[],
  completedDates: ReadonlySet<string>,
  today: string,
) {
  const month = scheduleStats(habit, days, completedDates, '9999-12-31');
  const elapsed = scheduleStats(habit, days, completedDates, today);
  const goal = Math.min(habit.monthlyTarget, month.total);
  const completed = Math.min(goal, elapsed.completed);
  return {
    completed,
    goal,
    percentage: goal ? Math.min(100, Math.round((completed / goal) * 100)) : 0,
  };
}
