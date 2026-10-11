import { describe, expect, it } from 'vitest';
import { dailyActualTotals, dailyMealPlanTotals, mealWeekSummary } from '@/lib/nutrition/summary';

describe('optional meal checklist feedback', () => {
  it('keeps absent days unrecorded rather than skipped or consumed', () => {
    expect(
      mealWeekSummary(
        [
          { date: '2026-10-05', status: 'followed' },
          { date: '2026-10-05', status: 'not_followed' },
          { date: '2026-10-07', status: 'followed' },
          { date: '2026-10-08', status: 'missed' },
        ],
        '2026-10-05',
        '2026-10-09',
      ),
    ).toEqual({
      recordedDays: 3,
      followedItems: 2,
      notFollowedItems: 1,
      missedItems: 1,
      unrecordedDays: 2,
    });
  });

  it('uses calendar week boundaries across years and ignores future or adjacent weeks', () => {
    expect(
      mealWeekSummary(
        [
          { date: '2026-12-27', status: 'followed' },
          { date: '2027-01-01', status: 'followed' },
          { date: '2027-01-04', status: 'not_followed' },
        ],
        '2026-12-28',
        '2027-01-03',
      ),
    ).toEqual({
      recordedDays: 1,
      followedItems: 1,
      notFollowedItems: 0,
      missedItems: 0,
      unrecordedDays: 6,
    });
    expect(mealWeekSummary([], '2026-10-05', '2026-10-05').unrecordedDays).toBe(1);
  });

  it('totals only active meal plans and identifies missing macro values', () => {
    expect(
      dailyMealPlanTotals([
        {
          active: true,
          plannedCalories: 300,
          plannedProtein: 50,
          plannedCarbs: 60,
          plannedFat: 20,
        },
        {
          active: true,
          plannedCalories: null,
          plannedProtein: null,
          plannedCarbs: 40,
          plannedFat: null,
        },
        {
          active: false,
          plannedCalories: 500,
          plannedProtein: 30,
          plannedCarbs: 80,
          plannedFat: 15,
        },
      ]),
    ).toEqual({
      mealCount: 2,
      items: [
        { label: 'Calories', unit: 'kcal', total: 300, entered: 1 },
        { label: 'Protein', unit: 'g', total: 50, entered: 1 },
        { label: 'Carbs', unit: 'g', total: 100, entered: 2 },
        { label: 'Fat', unit: 'g', total: 20, entered: 1 },
      ],
    });
  });

  it('adds only actual amounts entered and keeps missing nutrients distinct from zero', () => {
    expect(
      dailyActualTotals([
        { actualCalories: 300, actualProtein: 30, actualCarbs: null, actualFat: 0 },
        { actualCalories: null, actualProtein: 20, actualCarbs: null, actualFat: null },
      ]),
    ).toEqual([
      { label: 'Calories', unit: 'kcal', total: 300, entered: 1 },
      { label: 'Protein', unit: 'g', total: 50, entered: 2 },
      { label: 'Carbs', unit: 'g', total: 0, entered: 0 },
      { label: 'Fat', unit: 'g', total: 0, entered: 1 },
    ]);
  });
});
