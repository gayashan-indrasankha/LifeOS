import { addCalendarDays } from '@/lib/planning/time-blocks';

export type MealStatus = 'followed' | 'not_followed' | 'missed';
export type MealLog = { date: string; status: MealStatus | null };

export type ActualMealAmounts = {
  actualCalories: number | null;
  actualProtein: number | null;
  actualCarbs: number | null;
  actualFat: number | null;
};

export function dailyActualTotals(logs: ActualMealAmounts[]) {
  return [
    { label: 'Calories', unit: 'kcal', values: logs.map((log) => log.actualCalories) },
    { label: 'Protein', unit: 'g', values: logs.map((log) => log.actualProtein) },
    { label: 'Carbs', unit: 'g', values: logs.map((log) => log.actualCarbs) },
    { label: 'Fat', unit: 'g', values: logs.map((log) => log.actualFat) },
  ].map(({ label, unit, values }) => ({
    label,
    unit,
    total: values.reduce<number>((sum, value) => sum + (value ?? 0), 0),
    entered: values.filter((value) => value != null).length,
  }));
}

export type PlannedMeal = {
  active: boolean;
  plannedCalories: number | null;
  plannedProtein: number | null;
  plannedCarbs: number | null;
  plannedFat: number | null;
};

export function dailyMealPlanTotals(meals: PlannedMeal[]) {
  const activeMeals = meals.filter((meal) => meal.active);
  const items = [
    { label: 'Calories', unit: 'kcal', values: activeMeals.map((meal) => meal.plannedCalories) },
    { label: 'Protein', unit: 'g', values: activeMeals.map((meal) => meal.plannedProtein) },
    { label: 'Carbs', unit: 'g', values: activeMeals.map((meal) => meal.plannedCarbs) },
    { label: 'Fat', unit: 'g', values: activeMeals.map((meal) => meal.plannedFat) },
  ].map(({ label, unit, values }) => ({
    label,
    unit,
    total: values.reduce<number>((sum, value) => sum + (value ?? 0), 0),
    entered: values.filter((value) => value != null).length,
  }));
  return { mealCount: activeMeals.length, items };
}

/** Absence is unrecorded, never a skipped meal or an intake estimate. */
export function mealWeekSummary(logs: MealLog[], start: string, today: string) {
  const days = Array.from({ length: 7 }, (_, index) => addCalendarDays(start, index)).filter(
    (date) => date <= today,
  );
  const inWeek = logs.filter((item) => days.includes(item.date));
  const recordedDays = new Set(inWeek.map((item) => item.date)).size;
  return {
    recordedDays,
    followedItems: inWeek.filter((item) => item.status === 'followed').length,
    notFollowedItems: inWeek.filter((item) => item.status === 'not_followed').length,
    missedItems: inWeek.filter((item) => item.status === 'missed').length,
    unrecordedDays: days.length - recordedDays,
  };
}
