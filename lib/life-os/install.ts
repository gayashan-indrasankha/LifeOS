import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  goals,
  projects,
  tasks,
  subjects,
  habits,
  habitScheduleRevisions,
  interviewTopics,
  mealTemplates,
  userSettings,
  lifeOsSeedItems,
} from '@/lib/db/schema';
import { getTodayInTimezone, toDateString } from '@/lib/utils/date';
import {
  goals as goalPreset,
  habits as habitPreset,
  meals,
  projects as projectPreset,
  tasks as taskPreset,
  topics,
  type Section,
} from './preset';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type PlanItem = {
  section: Section;
  type: string;
  key: string;
  name: string;
  detail: string;
  status: 'new' | 'existing' | 'archived' | 'deleted' | 'duplicate' | 'conflict';
  reason?: string;
};
export type Plan = { items: PlanItem[]; needsInput: string[]; today: string };
export type SetupOptions = {
  sections: Section[];
  confirm: boolean;
};

const active = (status: string | null | undefined) => status !== 'archived' && status !== 'paused';
const detail = (item: { name: string }, description?: string) => description ?? item.name;

async function inspect(tx: Tx, userId: string, options: SetupOptions): Promise<Plan> {
  const [setting] = await tx
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  const today = toDateString(getTodayInTimezone(setting?.timezone ?? 'Asia/Colombo'));
  const [
    savedGoals,
    savedProjects,
    savedTasks,
    savedSubjects,
    savedHabits,
    savedTopics,
    savedMeals,
    seedItems,
  ] = await Promise.all([
    tx.select().from(goals).where(eq(goals.userId, userId)),
    tx.select().from(projects).where(eq(projects.userId, userId)),
    tx.select().from(tasks).where(eq(tasks.userId, userId)),
    tx.select().from(subjects).where(eq(subjects.userId, userId)),
    tx.select().from(habits).where(eq(habits.userId, userId)),
    tx.select().from(interviewTopics).where(eq(interviewTopics.userId, userId)),
    tx.select().from(mealTemplates).where(eq(mealTemplates.userId, userId)),
    tx.select().from(lifeOsSeedItems).where(eq(lifeOsSeedItems.userId, userId)),
  ]);
  const seeded = new Set(seedItems.map((item) => `${item.itemType}:${item.templateKey}`));
  const chosen = new Set(options.sections);
  const items: PlanItem[] = [];
  const add = (
    section: Section,
    type: string,
    key: string,
    name: string,
    description: string,
    existing:
      | {
          templateKey?: string | null;
          name?: string;
          title?: string;
          status?: string;
          archived?: boolean;
          archivedAt?: Date | null;
          active?: boolean;
        }
      | undefined,
    duplicate: boolean,
  ) => {
    const status: PlanItem['status'] = existing
      ? existing.archived ||
        !!existing.archivedAt ||
        existing.active === false ||
        !active(existing.status)
        ? 'archived'
        : 'existing'
      : seeded.has(`${type}:${key}`)
        ? 'deleted'
        : duplicate
          ? 'duplicate'
          : 'new';
    const reason =
      status === 'archived'
        ? 'Previously archived or paused; restore manually if wanted.'
        : status === 'deleted'
          ? 'Previously removed; this preset will not recreate it automatically.'
          : status === 'duplicate'
            ? 'Similar user-created record; review manually to avoid a duplicate.'
            : status === 'existing'
              ? 'Matching managed record is kept without changes.'
              : undefined;
    items.push({ section, type, key, name, detail: description, status, reason });
  };
  for (const item of goalPreset.filter((item) => chosen.has(item.section)))
    add(
      item.section,
      'Goal',
      item.key,
      item.name,
      detail(item, item.description),
      savedGoals.find((row) => row.templateKey === item.key),
      savedGoals.some((row) => !row.templateKey && row.title === item.name),
    );
  for (const item of projectPreset.filter((item) => chosen.has(item.section)))
    add(
      item.section,
      'Project',
      item.key,
      item.name,
      `Goal: ${goalPreset.find((goal) => goal.key === item.goal)?.name}`,
      savedProjects.find((row) => row.templateKey === item.key),
      savedProjects.some((row) => !row.templateKey && row.name === item.name),
    );
  for (const item of taskPreset.filter((item) => chosen.has(item.section)))
    add(
      item.section,
      item.milestone ? 'Milestone' : 'Starter task',
      item.key,
      item.name,
      item.project
        ? `Project: ${projectPreset.find((project) => project.key === item.project)?.name}`
        : (item.details ?? 'Editable suggestion'),
      savedTasks.find((row) => row.templateKey === item.key),
      savedTasks.some((row) => !row.templateKey && row.title === item.name),
    );
  if (chosen.has('university'))
    for (let slot = 1; slot <= 5; slot++) {
      const row = savedSubjects.find((subject) => subject.slot === slot);
      items.push({
        section: 'university',
        type: 'Subject slot',
        key: `subject-${slot}`,
        name: row?.name ?? `Subject ${slot}`,
        detail: 'Editable placeholder; no subject name or grade is assumed.',
        status: row ? 'existing' : seeded.has(`Subject slot:subject-${slot}`) ? 'deleted' : 'new',
      });
    }
  for (const item of habitPreset.filter((item) => chosen.has(item.section)))
    add(
      item.section,
      'Habit',
      item.key,
      item.name,
      `${item.schedule}; ${item.description ?? 'No completion is recorded.'}`,
      savedHabits.find((row) => row.templateKey === item.key),
      savedHabits.some((row) => !row.templateKey && row.name === item.name),
    );
  for (const item of topics.filter((item) => chosen.has(item.section)))
    add(
      item.section,
      'Interview topic',
      item.key,
      item.name,
      `${item.track} starter topic; no practice or score is recorded.`,
      savedTopics.find((row) => row.templateKey === item.key),
      savedTopics.some(
        (row) => !row.templateKey && row.title === item.name && row.roleTrack === item.track,
      ),
    );
  for (const item of meals.filter((item) => chosen.has(item.section))) {
    const existing = savedMeals.find((row) => row.templateKey === item.key);
    add(
      item.section,
      'Meal template',
      item.key,
      item.name,
      'Editable meal slot; set planned calories, protein, carbs and fat in Settings, then log actual amounts on Today.',
      existing,
      savedMeals.some((row) => !row.templateKey && row.name === item.name),
    );
    const entry = items.at(-1)!;
    if (
      entry.status === 'new' &&
      savedMeals.length +
        items.filter((row) => row.type === 'Meal template' && row.status === 'new').length >
        6
    ) {
      entry.status = 'conflict';
      entry.reason = 'The meal checklist supports six slots; review existing meals first.';
    }
  }
  if (chosen.has('nutrition')) {
    const alreadyConfigured =
      seeded.has('Nutrition checklist:enabled') ||
      savedMeals.some((meal) => meal.templateKey?.startsWith('meal-'));
    items.push({
      section: 'nutrition',
      type: 'Nutrition checklist',
      key: 'enabled',
      name: 'Show meal checklist on Today',
      detail: 'The six meal slots can be planned in Settings and logged on Today.',
      status: setting?.nutritionEnabled ? 'existing' : alreadyConfigured ? 'archived' : 'new',
      reason:
        !setting?.nutritionEnabled && alreadyConfigured
          ? 'The checklist was previously set up and is paused; resume it in Settings if wanted.'
          : undefined,
    });
  }
  const dependencyAvailable = (type: string, key: string) => {
    const dependency = items.find((entry) => entry.type === type && entry.key === key);
    return dependency?.status === 'new' || dependency?.status === 'existing';
  };
  const projectByKey = new Map(projectPreset.map((item) => [item.key, item]));
  const taskByKey = new Map(taskPreset.map((item) => [item.key, item]));
  for (const entry of items) {
    if (entry.status !== 'new') continue;
    const project = entry.type === 'Project' ? projectByKey.get(entry.key) : undefined;
    const task =
      entry.type === 'Milestone' || entry.type === 'Starter task'
        ? taskByKey.get(entry.key)
        : undefined;
    const goalKey = project?.goal ?? task?.goal;
    const projectKey = task?.project;
    if (
      (goalKey && !dependencyAvailable('Goal', goalKey)) ||
      (projectKey && !dependencyAvailable('Project', projectKey))
    ) {
      entry.status = 'conflict';
      entry.reason = 'Related goal or project is unavailable; review it before adding this item.';
    }
  }
  return {
    items,
    today,
    needsInput: [
      ...(chosen.has('university')
        ? ['Replace subject placeholders with real names and assessment dates when known.']
        : []),
      ...(taskPreset.some((task) => chosen.has(task.section))
        ? ['Pick days for starter tasks in Week, then choose up to three priorities on Today.']
        : []),
      ...(chosen.has('nutrition')
        ? ['Add your planned meal amounts in Settings and actual amounts on Today.']
        : []),
      ...(chosen.has('fitness')
        ? ['Record measured weight on Today only after weighing yourself.']
        : []),
      ...(chosen.has('interview') || chosen.has('english') || chosen.has('career')
        ? ['Record real practice outcomes or applications in Evidence only after they occur.']
        : []),
    ],
  };
}

export async function previewPersonalLifeOs(userId: string, options: SetupOptions): Promise<Plan> {
  return db.transaction((tx) => inspect(tx, userId, options));
}

export async function installPersonalLifeOs(userId: string, options: SetupOptions) {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${`habitflow-setup:${userId}`}, 0))`,
    );
    const plan = await inspect(tx, userId, options);
    const allowed = (type: string, key: string) =>
      plan.items.find((item) => item.type === type && item.key === key)?.status === 'new';
    const counts = {
      created: 0,
      existing: plan.items.filter(
        (item) =>
          item.status === 'existing' || item.status === 'archived' || item.status === 'deleted',
      ).length,
      conflicts: plan.items.filter(
        (item) => item.status === 'conflict' || item.status === 'duplicate',
      ).length,
    };
    await tx
      .insert(userSettings)
      .values({ userId, timezone: 'Asia/Colombo', weekStartsOn: 1, theme: 'system' })
      .onConflictDoNothing();
    const goalIds = new Map(
      (await tx.select().from(goals).where(eq(goals.userId, userId)))
        .filter((row) => row.templateKey)
        .map((row) => [row.templateKey!, row.id]),
    );
    for (const item of goalPreset.filter((item) => options.sections.includes(item.section))) {
      if (allowed('Goal', item.key)) {
        const [row] = await tx
          .insert(goals)
          .values({
            userId,
            templateKey: item.key,
            area: item.area,
            title: item.name,
            description: item.description,
            targetValue: item.targetValue,
            targetUnit: item.targetUnit,
          })
          .onConflictDoNothing()
          .returning({ id: goals.id });
        if (row) {
          goalIds.set(item.key, row.id);
          counts.created++;
        }
      }
    }
    const projectIds = new Map(
      (await tx.select().from(projects).where(eq(projects.userId, userId)))
        .filter((row) => row.templateKey)
        .map((row) => [row.templateKey!, row.id]),
    );
    for (const item of projectPreset.filter((item) => options.sections.includes(item.section))) {
      if (allowed('Project', item.key) && goalIds.has(item.goal)) {
        const [row] = await tx
          .insert(projects)
          .values({
            userId,
            templateKey: item.key,
            name: item.name,
            type: item.type,
            goalId: goalIds.get(item.goal),
          })
          .onConflictDoNothing()
          .returning({ id: projects.id });
        if (row) {
          projectIds.set(item.key, row.id);
          counts.created++;
        }
      }
    }
    for (const item of taskPreset.filter((item) => options.sections.includes(item.section))) {
      if (!allowed(item.milestone ? 'Milestone' : 'Starter task', item.key)) continue;
      if (item.project && !projectIds.has(item.project)) continue;
      if (item.goal && !goalIds.has(item.goal)) continue;
      const [row] = await tx
        .insert(tasks)
        .values({
          userId,
          templateKey: item.key,
          title: item.name,
          details: item.details,
          area:
            item.section === 'university'
              ? 'Education & Skills'
              : item.section === 'english'
                ? 'Personal Development'
                : 'Career',
          goalId: item.goal
            ? goalIds.get(item.goal)
            : item.project
              ? goalIds.get(projectPreset.find((project) => project.key === item.project)!.goal)
              : null,
          projectId: item.project ? projectIds.get(item.project) : null,
          isMilestone: !!item.milestone,
        })
        .onConflictDoNothing()
        .returning({ id: tasks.id });
      if (row) counts.created++;
    }
    if (options.sections.includes('university'))
      for (let slot = 1; slot <= 5; slot++)
        if (allowed('Subject slot', `subject-${slot}`)) {
          const [row] = await tx
            .insert(subjects)
            .values({ userId, slot, name: `Subject ${slot}` })
            .onConflictDoNothing()
            .returning({ id: subjects.id });
          if (row) counts.created++;
        }
    for (const item of habitPreset.filter((item) => options.sections.includes(item.section)))
      if (allowed('Habit', item.key)) {
        const [row] = await tx
          .insert(habits)
          .values({
            userId,
            templateKey: item.key,
            name: item.name,
            description: item.description,
            category: item.category,
            schedule: item.schedule,
            monthlyTarget: item.target,
            startDate: plan.today,
          })
          .onConflictDoNothing()
          .returning({ id: habits.id });
        if (row) {
          await tx.insert(habitScheduleRevisions).values({
            userId,
            habitId: row.id,
            effectiveDate: plan.today,
            schedule: item.schedule,
            startDate: plan.today,
            status: 'active',
          });
          counts.created++;
        }
      }
    for (const item of topics.filter((item) => options.sections.includes(item.section)))
      if (allowed('Interview topic', item.key)) {
        const [row] = await tx
          .insert(interviewTopics)
          .values({
            userId,
            templateKey: item.key,
            category: item.category,
            title: item.name,
            roleTrack: item.track,
          })
          .onConflictDoNothing()
          .returning({ id: interviewTopics.id });
        if (row) counts.created++;
      }
    for (const item of meals.filter((item) => options.sections.includes(item.section)))
      if (allowed('Meal template', item.key)) {
        const [row] = await tx
          .insert(mealTemplates)
          .values({
            userId,
            templateKey: item.key,
            name: item.name,
            notes: item.notes,
            sortOrder: item.order,
          })
          .onConflictDoNothing()
          .returning({ id: mealTemplates.id });
        if (row) counts.created++;
      }
    if (allowed('Nutrition checklist', 'enabled')) {
      await tx
        .update(userSettings)
        .set({ nutritionEnabled: true })
        .where(eq(userSettings.userId, userId));
      counts.created++;
    }
    if (counts.created !== plan.items.filter((item) => item.status === 'new').length)
      throw new Error(
        'The proposed setup changed during installation. No partial changes were saved; preview again.',
      );
    const installed = new Set<string>();
    const collect = (type: string, keys: (string | null)[]) =>
      keys.forEach((key) => {
        if (key) installed.add(`${type}:${key}`);
      });
    collect(
      'Goal',
      (await tx.select({ key: goals.templateKey }).from(goals).where(eq(goals.userId, userId))).map(
        (row) => row.key,
      ),
    );
    collect(
      'Project',
      (
        await tx
          .select({ key: projects.templateKey })
          .from(projects)
          .where(eq(projects.userId, userId))
      ).map((row) => row.key),
    );
    const taskRows = await tx
      .select({ key: tasks.templateKey, milestone: tasks.isMilestone })
      .from(tasks)
      .where(eq(tasks.userId, userId));
    taskRows.forEach((row) => collect(row.milestone ? 'Milestone' : 'Starter task', [row.key]));
    collect(
      'Subject slot',
      (
        await tx.select({ slot: subjects.slot }).from(subjects).where(eq(subjects.userId, userId))
      ).map((row) => `subject-${row.slot}`),
    );
    collect(
      'Habit',
      (
        await tx.select({ key: habits.templateKey }).from(habits).where(eq(habits.userId, userId))
      ).map((row) => row.key),
    );
    collect(
      'Interview topic',
      (
        await tx
          .select({ key: interviewTopics.templateKey })
          .from(interviewTopics)
          .where(eq(interviewTopics.userId, userId))
      ).map((row) => row.key),
    );
    collect(
      'Meal template',
      (
        await tx
          .select({ key: mealTemplates.templateKey })
          .from(mealTemplates)
          .where(eq(mealTemplates.userId, userId))
      ).map((row) => row.key),
    );
    const [settings] = await tx
      .select({ nutritionEnabled: userSettings.nutritionEnabled })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);
    if (settings?.nutritionEnabled) installed.add('Nutrition checklist:enabled');
    for (const item of plan.items)
      if (installed.has(`${item.type}:${item.key}`)) {
        await tx
          .insert(lifeOsSeedItems)
          .values({ userId, itemType: item.type, templateKey: item.key })
          .onConflictDoNothing();
      }
    return { ...counts, plan };
  });
}
