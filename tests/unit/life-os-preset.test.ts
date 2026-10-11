import { describe, expect, it } from 'vitest';
import { goals, habits, meals, projects, tasks, topics, sectionLabels } from '@/lib/life-os/preset';
import { LIFE_AREAS } from '@/lib/life-areas';

describe('Personal Life OS preset', () => {
  it('uses current life areas and unique keys', () => {
    for (const goal of goals) expect(LIFE_AREAS).toContain(goal.area);
    for (const habit of habits) expect(LIFE_AREAS).toContain(habit.category);
    for (const group of [goals, projects, tasks, habits, topics, meals])
      expect(new Set(group.map((item) => item.key)).size).toBe(group.length);
  });

  it('links goals, projects and starter tasks without invented dates or outcomes', () => {
    for (const project of projects)
      expect(goals.some((goal) => goal.key === project.goal)).toBe(true);
    for (const task of tasks) {
      if (task.goal) expect(goals.some((goal) => goal.key === task.goal)).toBe(true);
      if (task.project) expect(projects.some((project) => project.key === task.project)).toBe(true);
    }
    expect(tasks).toHaveLength(30);
    expect(tasks.every((task) => !('scheduledDate' in task))).toBe(true);
    expect(topics).toHaveLength(21);
    expect(habits.find((item) => item.key === 'weigh-in')?.description).toContain(
      'Record an actual weight separately',
    );
  });

  it('sets up six blank meal slots and leaves monthly insights to recorded data', () => {
    expect(meals).toHaveLength(6);
    expect(meals.every((meal) => !('plannedCalories' in meal))).toBe(true);
    expect(sectionLabels).not.toHaveProperty('review');
    expect(goals.some((goal) => goal.key === 'nutrition-reference')).toBe(false);
  });
});
