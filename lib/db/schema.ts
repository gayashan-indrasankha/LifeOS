import {
  boolean,
  date,
  doublePrecision,
  foreignKey,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Better Auth managed tables
// ---------------------------------------------------------------------------
export const users = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Keeps an installation decision after a user deletes a seeded record. Reapplying
// the preset must never silently recreate that record.
export const lifeOsSeedItems = pgTable(
  'life_os_seed_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    itemType: varchar('item_type', { length: 32 }).notNull(),
    templateKey: varchar('template_key', { length: 100 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('life_os_seed_items_user_type_key_idx').on(
      table.userId,
      table.itemType,
      table.templateKey,
    ),
  ],
);

export const sessions = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => [index('session_user_id_idx').on(table.userId)],
);

export const accounts = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('account_user_provider_idx').on(table.userId, table.providerId)],
);

export const verifications = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
);

// ---------------------------------------------------------------------------
// Application tables
// ---------------------------------------------------------------------------
export const habits = pgTable(
  'habits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    description: text('description'),
    icon: varchar('icon', { length: 50 }),
    category: varchar('category', { length: 60 }),
    monthlyTarget: smallint('monthly_target').notNull().default(20),
    schedule: text('schedule').notNull().default('daily'),
    templateKey: varchar('template_key', { length: 100 }),
    startDate: date('start_date').notNull(),
    endDate: date('end_date'),
    archived: boolean('archived').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('habits_user_id_idx').on(table.userId),
    index('habits_user_archived_sort_idx').on(table.userId, table.archived, table.sortOrder),
    uniqueIndex('habits_user_template_idx').on(table.userId, table.templateKey),
    unique('habits_user_id_id_unique').on(table.userId, table.id),
  ],
);

export const habitScheduleRevisions = pgTable(
  'habit_schedule_revisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),
    habitId: uuid('habit_id').notNull(),
    effectiveDate: date('effective_date').notNull(),
    schedule: text('schedule').notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date'),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    source: varchar('source', { length: 20 }).notNull().default('recorded'),
  },
  (table) => [
    unique('habit_schedule_revisions_habit_date_unique').on(table.habitId, table.effectiveDate),
    index('habit_schedule_revisions_user_date_idx').on(table.userId, table.effectiveDate),
    foreignKey({
      columns: [table.userId, table.habitId],
      foreignColumns: [habits.userId, habits.id],
      name: 'habit_schedule_revisions_owner_fk',
    }).onDelete('cascade'),
  ],
);

export const habitEntries = pgTable(
  'habit_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    habitId: uuid('habit_id')
      .notNull()
      .references(() => habits.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    completed: boolean('completed').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('habit_entries_habit_date_unique').on(table.habitId, table.date),
    index('habit_entries_user_month_idx').on(table.userId, table.date),
    index('habit_entries_habit_date_idx').on(table.habitId, table.date),
    foreignKey({
      columns: [table.userId, table.habitId],
      foreignColumns: [habits.userId, habits.id],
      name: 'habit_entries_owner_fk',
    }).onDelete('cascade'),
  ],
);

export const dailyNotes = pgTable(
  'daily_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('daily_notes_user_date_unique').on(table.userId, table.date),
    index('daily_notes_user_date_idx').on(table.userId, table.date),
  ],
);

export const mealTemplates = pgTable(
  'meal_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    templateKey: varchar('template_key', { length: 100 }),
    notes: text('notes'),
    preferredTime: varchar('preferred_time', { length: 5 }),
    plannedCalories: integer('planned_calories'),
    plannedProtein: integer('planned_protein'),
    plannedCarbs: integer('planned_carbs'),
    plannedFat: integer('planned_fat'),
    active: boolean('active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('meal_templates_user_sort_idx').on(table.userId, table.sortOrder),
    unique('meal_templates_user_id_id_unique').on(table.userId, table.id),
    uniqueIndex('meal_templates_user_template_idx').on(table.userId, table.templateKey),
  ],
);

export const mealLogs = pgTable(
  'meal_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    mealId: uuid('meal_id').notNull(),
    date: date('date').notNull(),
    status: varchar('status', { length: 20 }),
    actualCalories: integer('actual_calories'),
    actualProtein: integer('actual_protein'),
    actualCarbs: integer('actual_carbs'),
    actualFat: integer('actual_fat'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('meal_logs_meal_date_unique').on(table.mealId, table.date),
    index('meal_logs_user_date_idx').on(table.userId, table.date),
    foreignKey({
      columns: [table.userId, table.mealId],
      foreignColumns: [mealTemplates.userId, mealTemplates.id],
      name: 'meal_logs_owner_fk',
    }).onDelete('cascade'),
  ],
);

export const userSettings = pgTable('user_settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  timezone: varchar('timezone', { length: 60 }).notNull().default('UTC'),
  weekStartsOn: smallint('week_starts_on').notNull().default(1),
  theme: varchar('theme', { length: 20 }).notNull().default('system'),
  flexibleCapacityMinutes: integer('flexible_capacity_minutes'),
  nutritionEnabled: boolean('nutrition_enabled').notNull().default(false),
});

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------
export const usersRelations = relations(users, ({ many, one }) => ({
  habits: many(habits),
  habitEntries: many(habitEntries),
  dailyNotes: many(dailyNotes),
  settings: one(userSettings, {
    fields: [users.id],
    references: [userSettings.userId],
  }),
}));

export const habitsRelations = relations(habits, ({ one, many }) => ({
  user: one(users, { fields: [habits.userId], references: [users.id] }),
  entries: many(habitEntries),
  scheduleRevisions: many(habitScheduleRevisions),
}));

export const habitScheduleRevisionsRelations = relations(habitScheduleRevisions, ({ one }) => ({
  habit: one(habits, { fields: [habitScheduleRevisions.habitId], references: [habits.id] }),
}));

export const habitEntriesRelations = relations(habitEntries, ({ one }) => ({
  habit: one(habits, { fields: [habitEntries.habitId], references: [habits.id] }),
  user: one(users, { fields: [habitEntries.userId], references: [users.id] }),
}));

export const dailyNotesRelations = relations(dailyNotes, ({ one }) => ({
  user: one(users, { fields: [dailyNotes.userId], references: [users.id] }),
}));

// Life OS records are additive. Existing habit, entry and note IDs remain stable.
export const goals = pgTable(
  'goals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    area: varchar('area', { length: 80 }).notNull(),
    title: varchar('title', { length: 160 }).notNull(),
    description: text('description'),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    priority: smallint('priority').notNull().default(2),
    targetDate: date('target_date'),
    targetValue: doublePrecision('target_value'),
    targetUnit: varchar('target_unit', { length: 32 }),
    templateKey: varchar('template_key', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('goals_user_status_idx').on(t.userId, t.status),
    unique('goals_user_id_id_unique').on(t.userId, t.id),
    uniqueIndex('goals_user_template_idx').on(t.userId, t.templateKey),
  ],
);

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    goalId: uuid('goal_id'),
    name: varchar('name', { length: 160 }).notNull(),
    description: text('description'),
    type: varchar('type', { length: 60 }).notNull().default('General'),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    deadline: date('deadline'),
    repositoryUrl: text('repository_url'),
    templateKey: varchar('template_key', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('projects_user_status_idx').on(t.userId, t.status),
    unique('projects_user_id_id_unique').on(t.userId, t.id),
    uniqueIndex('projects_user_template_idx').on(t.userId, t.templateKey),
    foreignKey({
      columns: [t.userId, t.goalId],
      foreignColumns: [goals.userId, goals.id],
      name: 'projects_goal_owner_fk',
    }),
  ],
);

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    goalId: uuid('goal_id'),
    projectId: uuid('project_id'),
    title: varchar('title', { length: 160 }).notNull(),
    templateKey: varchar('template_key', { length: 100 }),
    details: text('details'),
    checklist: text('checklist'),
    checklistResetDaily: boolean('checklist_reset_daily').notNull().default(false),
    area: varchar('area', { length: 80 }).notNull().default('Personal Development'),
    status: varchar('status', { length: 20 }).notNull().default('todo'),
    priority: smallint('priority').notNull().default(2),
    estimatedMinutes: integer('estimated_minutes'),
    actualMinutes: integer('actual_minutes'),
    dueDate: date('due_date'),
    scheduledDate: date('scheduled_date'),
    recurrence: varchar('recurrence', { length: 12 }).notNull().default('once'),
    weekdays: varchar('weekdays', { length: 7 }),
    dailyPriority: smallint('daily_priority'),
    sortOrder: integer('sort_order').notNull().default(0),
    isMilestone: boolean('is_milestone').notNull().default(false),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('tasks_user_schedule_idx').on(t.userId, t.scheduledDate),
    index('tasks_user_project_idx').on(t.userId, t.projectId),
    uniqueIndex('tasks_user_date_priority_unique').on(t.userId, t.scheduledDate, t.dailyPriority),
    unique('tasks_user_id_id_unique').on(t.userId, t.id),
    uniqueIndex('tasks_user_template_idx').on(t.userId, t.templateKey),
    foreignKey({
      columns: [t.userId, t.goalId],
      foreignColumns: [goals.userId, goals.id],
      name: 'tasks_goal_owner_fk',
    }),
    foreignKey({
      columns: [t.userId, t.projectId],
      foreignColumns: [projects.userId, projects.id],
      name: 'tasks_project_owner_fk',
    }),
  ],
);

export const taskCompletions = pgTable(
  'task_completions',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id').notNull(),
    date: date('date').notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('task_completions_user_task_date_unique').on(t.userId, t.taskId, t.date),
    foreignKey({
      columns: [t.userId, t.taskId],
      foreignColumns: [tasks.userId, tasks.id],
    }).onDelete('cascade'),
  ],
);

export const taskChecklistCompletions = pgTable(
  'task_checklist_completions',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id').notNull(),
    itemId: uuid('item_id').notNull(),
    date: date('date').notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('task_checklist_completions_user_task_item_date_unique').on(
      t.userId,
      t.taskId,
      t.itemId,
      t.date,
    ),
    index('task_checklist_completions_user_date_idx').on(t.userId, t.date),
    foreignKey({
      columns: [t.userId, t.taskId],
      foreignColumns: [tasks.userId, tasks.id],
    }).onDelete('cascade'),
  ],
);

export const timeOffDays = pgTable(
  'time_off_days',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    type: varchar('type', { length: 20 }).notNull(),
    title: varchar('title', { length: 160 }),
    note: text('note'),
    allDay: boolean('all_day').notNull().default(true),
    localStartTime: varchar('local_start_time', { length: 5 }),
    localEndTime: varchar('local_end_time', { length: 5 }),
    status: varchar('status', { length: 12 }).notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('time_off_days_user_date_unique').on(t.userId, t.date),
    unique('time_off_days_user_id_id_unique').on(t.userId, t.id),
    index('time_off_days_user_date_idx').on(t.userId, t.date),
  ],
);

export const timeBlocks = pgTable(
  'time_blocks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 160 }).notNull(),
    category: varchar('category', { length: 80 }).notNull(),
    localStartTime: varchar('local_start_time', { length: 5 }).notNull(),
    localEndTime: varchar('local_end_time', { length: 5 }).notNull(),
    weekdayMask: varchar('weekday_mask', { length: 7 }).notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date'),
    isFixed: boolean('is_fixed').notNull().default(false),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    goalId: uuid('goal_id'),
    projectId: uuid('project_id'),
    taskId: uuid('task_id'),
    templateKey: varchar('template_key', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('time_blocks_user_dates_idx').on(t.userId, t.startDate, t.endDate),
    unique('time_blocks_user_id_id_unique').on(t.userId, t.id),
    uniqueIndex('time_blocks_user_template_idx').on(t.userId, t.templateKey),
    foreignKey({
      columns: [t.userId, t.goalId],
      foreignColumns: [goals.userId, goals.id],
      name: 'time_blocks_goal_owner_fk',
    }),
    foreignKey({
      columns: [t.userId, t.projectId],
      foreignColumns: [projects.userId, projects.id],
      name: 'time_blocks_project_owner_fk',
    }),
    foreignKey({
      columns: [t.userId, t.taskId],
      foreignColumns: [tasks.userId, tasks.id],
      name: 'time_blocks_task_owner_fk',
    }),
  ],
);

export const timeBlockRevisions = pgTable(
  'time_block_revisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),
    blockId: uuid('block_id').notNull(),
    effectiveDate: date('effective_date').notNull(),
    title: varchar('title', { length: 160 }).notNull(),
    category: varchar('category', { length: 80 }).notNull(),
    localStartTime: varchar('local_start_time', { length: 5 }).notNull(),
    localEndTime: varchar('local_end_time', { length: 5 }).notNull(),
    weekdayMask: varchar('weekday_mask', { length: 7 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    endDate: date('end_date'),
    isFixed: boolean('is_fixed').notNull().default(false),
    taskId: uuid('task_id'),
    goalId: uuid('goal_id'),
    projectId: uuid('project_id'),
  },
  (t) => [
    unique('time_block_revisions_block_date_unique').on(t.blockId, t.effectiveDate),
    index('time_block_revisions_user_date_idx').on(t.userId, t.effectiveDate),
    foreignKey({
      columns: [t.userId, t.blockId],
      foreignColumns: [timeBlocks.userId, timeBlocks.id],
      name: 'time_block_revisions_owner_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.userId, t.taskId],
      foreignColumns: [tasks.userId, tasks.id],
      name: 'time_block_revisions_task_owner_fk',
    }),
    foreignKey({
      columns: [t.userId, t.goalId],
      foreignColumns: [goals.userId, goals.id],
      name: 'time_block_revisions_goal_owner_fk',
    }),
    foreignKey({
      columns: [t.userId, t.projectId],
      foreignColumns: [projects.userId, projects.id],
      name: 'time_block_revisions_project_owner_fk',
    }),
  ],
);

export const timeBlockExceptions = pgTable(
  'time_block_exceptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    blockId: uuid('block_id').notNull(),
    occurrenceDate: date('occurrence_date').notNull(),
    overrideDate: date('override_date'),
    overrideStartTime: varchar('override_start_time', { length: 5 }),
    overrideEndTime: varchar('override_end_time', { length: 5 }),
    status: varchar('status', { length: 20 }).notNull(),
    reason: text('reason'),
    actualMinutes: integer('actual_minutes'),
    timeOffId: uuid('time_off_id'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('time_block_exceptions_block_date_unique').on(t.blockId, t.occurrenceDate),
    index('time_block_exceptions_user_date_idx').on(t.userId, t.occurrenceDate),
    foreignKey({
      columns: [t.userId, t.blockId],
      foreignColumns: [timeBlocks.userId, timeBlocks.id],
      name: 'time_block_exceptions_owner_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.userId, t.timeOffId],
      foreignColumns: [timeOffDays.userId, timeOffDays.id],
      name: 'time_block_exceptions_time_off_owner_fk',
    }),
  ],
);

export const dayPlans = pgTable(
  'day_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    mode: varchar('mode', { length: 12 }).notNull().default('normal'),
    minimumHabitId: uuid('minimum_habit_id'),
    minimumAction: varchar('minimum_action', { length: 160 }),
    minimumActionDone: boolean('minimum_action_done').notNull().default(false),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('day_plans_user_date_unique').on(t.userId, t.date),
    foreignKey({
      columns: [t.userId, t.minimumHabitId],
      foreignColumns: [habits.userId, habits.id],
      name: 'day_plans_minimum_habit_owner_fk',
    }),
  ],
);

export const weeklyReviews = pgTable(
  'weekly_reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    weekStart: date('week_start').notNull(),
    answers: text('answers').notNull().default('{}'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('weekly_reviews_user_week_unique').on(t.userId, t.weekStart)],
);

export const metricEntries = pgTable(
  'metric_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    type: varchar('type', { length: 60 }).notNull(),
    value: doublePrecision('value').notNull(),
    unit: varchar('unit', { length: 24 }).notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('metric_entries_user_type_date_idx').on(t.userId, t.type, t.date)],
);

export const subjects = pgTable(
  'subjects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    slot: smallint('slot').notNull(),
    name: varchar('name', { length: 120 }),
    targetGrade: varchar('target_grade', { length: 20 }),
    actualGrade: varchar('actual_grade', { length: 20 }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('subjects_user_slot_unique').on(t.userId, t.slot),
    unique('subjects_user_id_id_unique').on(t.userId, t.id),
  ],
);

export const subjectAssessments = pgTable(
  'subject_assessments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    subjectId: uuid('subject_id').notNull(),
    title: varchar('title', { length: 160 }).notNull(),
    dueDate: date('due_date'),
    status: varchar('status', { length: 20 }).notNull().default('todo'),
    actualGrade: varchar('actual_grade', { length: 20 }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('subject_assessments_user_due_idx').on(t.userId, t.dueDate),
    foreignKey({
      columns: [t.userId, t.subjectId],
      foreignColumns: [subjects.userId, subjects.id],
      name: 'subject_assessments_owner_fk',
    }).onDelete('cascade'),
  ],
);

// P3 evidence is recorded independently of task completion and habit adherence.
export const subjectTopics = pgTable(
  'subject_topics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    subjectId: uuid('subject_id').notNull(),
    title: varchar('title', { length: 160 }).notNull(),
    priority: smallint('priority').notNull().default(2),
    status: varchar('status', { length: 24 }).notNull().default('not_started'),
    nextRevisionDate: date('next_revision_date'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('subject_topics_user_subject_idx').on(t.userId, t.subjectId),
    unique('subject_topics_user_id_id_unique').on(t.userId, t.id),
    foreignKey({
      columns: [t.userId, t.subjectId],
      foreignColumns: [subjects.userId, subjects.id],
      name: 'subject_topics_owner_fk',
    }).onDelete('cascade'),
  ],
);

export const topicPractices = pgTable(
  'topic_practices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    topicId: uuid('topic_id').notNull(),
    date: date('date').notNull(),
    type: varchar('type', { length: 32 }).notNull(),
    correct: integer('correct'),
    total: integer('total'),
    confidence: smallint('confidence'),
    durationMinutes: integer('duration_minutes'),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('topic_practices_user_date_idx').on(t.userId, t.date),
    foreignKey({
      columns: [t.userId, t.topicId],
      foreignColumns: [subjectTopics.userId, subjectTopics.id],
      name: 'topic_practices_owner_fk',
    }).onDelete('cascade'),
  ],
);

export const milestoneCriteria = pgTable(
  'milestone_criteria',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id').notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    met: boolean('met').notNull().default(false),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('milestone_criteria_user_task_idx').on(t.userId, t.taskId),
    foreignKey({
      columns: [t.userId, t.taskId],
      foreignColumns: [tasks.userId, tasks.id],
      name: 'milestone_criteria_owner_fk',
    }).onDelete('cascade'),
  ],
);

export const milestoneReviews = pgTable(
  'milestone_reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id').notNull(),
    state: varchar('state', { length: 24 }).notNull().default('not_reviewed'),
    reviewer: varchar('reviewer', { length: 80 }).notNull().default('Self-review'),
    reviewedOn: date('reviewed_on'),
    repositoryUrl: text('repository_url'),
    testReference: text('test_reference'),
    documentationUrl: text('documentation_url'),
    note: text('note'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('milestone_reviews_user_task_unique').on(t.userId, t.taskId),
    foreignKey({
      columns: [t.userId, t.taskId],
      foreignColumns: [tasks.userId, tasks.id],
      name: 'milestone_reviews_owner_fk',
    }).onDelete('cascade'),
  ],
);

export const milestoneReviewHistory = pgTable(
  'milestone_review_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id').notNull(),
    state: varchar('state', { length: 24 }).notNull(),
    reviewer: varchar('reviewer', { length: 80 }).notNull(),
    reviewedOn: date('reviewed_on'),
    criteriaSnapshot: text('criteria_snapshot').notNull(),
    repositoryUrl: text('repository_url'),
    testReference: text('test_reference'),
    documentationUrl: text('documentation_url'),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('milestone_review_history_user_task_idx').on(t.userId, t.taskId),
    foreignKey({
      columns: [t.userId, t.taskId],
      foreignColumns: [tasks.userId, tasks.id],
      name: 'milestone_review_history_owner_fk',
    }).onDelete('cascade'),
  ],
);

export const interviewTopics = pgTable(
  'interview_topics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    category: varchar('category', { length: 80 }).notNull(),
    title: varchar('title', { length: 160 }).notNull(),
    templateKey: varchar('template_key', { length: 100 }),
    roleTrack: varchar('role_track', { length: 16 }).notNull().default('Shared'),
  },
  (t) => [
    index('interview_topics_user_role_idx').on(t.userId, t.roleTrack),
    unique('interview_topics_user_id_id_unique').on(t.userId, t.id),
    uniqueIndex('interview_topics_user_template_idx').on(t.userId, t.templateKey),
  ],
);

export const interviewPractices = pgTable(
  'interview_practices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    topicId: uuid('topic_id'),
    topicText: varchar('topic_text', { length: 160 }),
    date: date('date').notNull(),
    roleTrack: varchar('role_track', { length: 16 }).notNull(),
    type: varchar('type', { length: 40 }).notNull(),
    prompt: text('prompt'),
    durationMinutes: integer('duration_minutes'),
    correct: integer('correct'),
    total: integer('total'),
    technical: smallint('technical'),
    approach: smallint('approach'),
    clarity: smallint('clarity'),
    tradeoffs: smallint('tradeoffs'),
    externalRating: smallint('external_rating'),
    strengths: text('strengths'),
    weaknesses: text('weaknesses'),
    nextAction: text('next_action'),
    followUpTaskId: uuid('follow_up_task_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('interview_practices_user_date_idx').on(t.userId, t.date),
    foreignKey({
      columns: [t.userId, t.topicId],
      foreignColumns: [interviewTopics.userId, interviewTopics.id],
      name: 'interview_practices_owner_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.userId, t.followUpTaskId],
      foreignColumns: [tasks.userId, tasks.id],
      name: 'interview_practices_task_owner_fk',
    }),
  ],
);

export const englishPractices = pgTable(
  'english_practices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    type: varchar('type', { length: 40 }).notNull(),
    topic: varchar('topic', { length: 160 }).notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    fluency: smallint('fluency'),
    grammar: smallint('grammar'),
    clarity: smallint('clarity'),
    pronunciation: smallint('pronunciation'),
    confidence: smallint('confidence'),
    reviewer: varchar('reviewer', { length: 80 }),
    reflection: text('reflection'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('english_practices_user_date_idx').on(t.userId, t.date),
    unique('english_practices_user_id_id_unique').on(t.userId, t.id),
  ],
);

export const grammarMistakes = pgTable(
  'grammar_mistakes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    practiceId: uuid('practice_id'),
    original: text('original').notNull(),
    corrected: text('corrected').notNull(),
    category: varchar('category', { length: 80 }).notNull(),
    note: text('note'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('grammar_mistakes_user_review_idx').on(t.userId, t.reviewedAt),
    foreignKey({
      columns: [t.userId, t.practiceId],
      foreignColumns: [englishPractices.userId, englishPractices.id],
      name: 'grammar_mistakes_practice_owner_fk',
    }),
  ],
);

export const internshipApplications = pgTable(
  'internship_applications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    company: varchar('company', { length: 160 }).notNull(),
    roleTitle: varchar('role_title', { length: 160 }).notNull(),
    roleTrack: varchar('role_track', { length: 16 }).notNull(),
    url: text('url'),
    location: varchar('location', { length: 160 }),
    arrangement: varchar('arrangement', { length: 24 }),
    appliedOn: date('applied_on'),
    stage: varchar('stage', { length: 32 }).notNull().default('saved'),
    followUpDate: date('follow_up_date'),
    contactName: varchar('contact_name', { length: 160 }),
    note: text('note'),
    followUpTaskId: uuid('follow_up_task_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('internship_applications_user_stage_idx').on(t.userId, t.stage),
    index('internship_applications_user_followup_idx').on(t.userId, t.followUpDate),
    unique('internship_applications_user_id_id_unique').on(t.userId, t.id),
    foreignKey({
      columns: [t.userId, t.followUpTaskId],
      foreignColumns: [tasks.userId, tasks.id],
      name: 'internship_applications_task_owner_fk',
    }),
  ],
);

export const applicationStageHistory = pgTable(
  'application_stage_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    applicationId: uuid('application_id').notNull(),
    fromStage: varchar('from_stage', { length: 32 }),
    toStage: varchar('to_stage', { length: 32 }).notNull(),
    stageOn: date('stage_on'),
    changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('application_stage_history_user_date_idx').on(t.userId, t.changedAt),
    foreignKey({
      columns: [t.userId, t.applicationId],
      foreignColumns: [internshipApplications.userId, internshipApplications.id],
      name: 'application_stage_history_owner_fk',
    }).onDelete('cascade'),
  ],
);
