import { getTableColumns } from 'drizzle-orm';
import {
  applicationStageHistory,
  dayPlans,
  dailyNotes,
  englishPractices,
  goals,
  grammarMistakes,
  habitEntries,
  habitScheduleRevisions,
  habits,
  internshipApplications,
  interviewPractices,
  interviewTopics,
  lifeOsSeedItems,
  mealLogs,
  mealTemplates,
  metricEntries,
  milestoneCriteria,
  milestoneReviewHistory,
  milestoneReviews,
  projects,
  subjectAssessments,
  subjectTopics,
  subjects,
  tasks,
  taskCompletions,
  timeBlockExceptions,
  timeBlockRevisions,
  timeBlocks,
  timeOffDays,
  topicPractices,
  userSettings,
  weeklyReviews,
} from '@/lib/db/schema';

// Parents precede their dependants. Restore uses this order; deletion reverses it.
export const backupTables = [
  ['lifeOsSeedItems', lifeOsSeedItems],
  ['habits', habits],
  ['habitScheduleRevisions', habitScheduleRevisions],
  ['habitEntries', habitEntries],
  ['mealTemplates', mealTemplates],
  ['mealLogs', mealLogs],
  ['dailyNotes', dailyNotes],
  ['userSettings', userSettings],
  ['goals', goals],
  ['projects', projects],
  ['tasks', tasks],
  ['taskCompletions', taskCompletions],
  ['timeOffDays', timeOffDays],
  ['timeBlocks', timeBlocks],
  ['timeBlockRevisions', timeBlockRevisions],
  ['timeBlockExceptions', timeBlockExceptions],
  ['dayPlans', dayPlans],
  ['weeklyReviews', weeklyReviews],
  ['metricEntries', metricEntries],
  ['subjects', subjects],
  ['subjectAssessments', subjectAssessments],
  ['subjectTopics', subjectTopics],
  ['topicPractices', topicPractices],
  ['milestoneCriteria', milestoneCriteria],
  ['milestoneReviews', milestoneReviews],
  ['milestoneReviewHistory', milestoneReviewHistory],
  ['interviewTopics', interviewTopics],
  ['interviewPractices', interviewPractices],
  ['englishPractices', englishPractices],
  ['grammarMistakes', grammarMistakes],
  ['internshipApplications', internshipApplications],
  ['applicationStageHistory', applicationStageHistory],
] as const;

export type ParsedBackup = {
  schemaVersion: 1 | 2;
  exportedAt: string;
  rows: Record<string, Record<string, unknown>[]>;
  totalRecords: number;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export class BackupFormatError extends Error {}

export function parseBackup(value: unknown): ParsedBackup {
  if (!isObject(value) || (value.schemaVersion !== 1 && value.schemaVersion !== 2)) {
    throw new BackupFormatError('This is not a supported LifeOS backup (version 1 or 2).');
  }
  if (typeof value.exportedAt !== 'string' || !Number.isFinite(Date.parse(value.exportedAt))) {
    throw new BackupFormatError('The backup is missing a valid export date.');
  }
  const allowed = new Set<string>([
    'schemaVersion',
    'exportedAt',
    ...backupTables.map(([name]) => name),
  ]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new BackupFormatError(`Unknown backup section: ${key}.`);
  }

  const rows: Record<string, Record<string, unknown>[]> = {};
  let totalRecords = 0;
  for (const [name, table] of backupTables) {
    const section = value[name];
    if (
      ((name === 'lifeOsSeedItems' && value.schemaVersion === 1) || name === 'taskCompletions') &&
      section === undefined
    ) {
      rows[name] = [];
      continue;
    }
    if (!Array.isArray(section)) throw new BackupFormatError(`Missing or invalid ${name} records.`);
    totalRecords += section.length;
    if (totalRecords > 100_000) throw new BackupFormatError('The backup has too many records.');
    const columns = getTableColumns(table);
    rows[name] = section.map((item, index) => {
      if (!isObject(item)) throw new BackupFormatError(`Invalid ${name} record ${index + 1}.`);
      const record: Record<string, unknown> = {};
      for (const key of Object.keys(item)) {
        if (key === 'userId' || !(key in columns)) {
          throw new BackupFormatError(`Unexpected field in ${name} record ${index + 1}: ${key}.`);
        }
      }
      for (const [key, column] of Object.entries(columns)) {
        if (key === 'userId') continue;
        const field = item[key];
        if (field === undefined) {
          if (key === 'id' || (column.notNull && !column.hasDefault)) {
            throw new BackupFormatError(`Missing ${key} in ${name} record ${index + 1}.`);
          }
          continue;
        }
        if (field === null) {
          if (column.notNull)
            throw new BackupFormatError(`Invalid ${key} in ${name} record ${index + 1}.`);
          record[key] = null;
          continue;
        }
        if (column.dataType === 'date') {
          if (typeof field !== 'string' || !Number.isFinite(Date.parse(field))) {
            throw new BackupFormatError(`Invalid ${key} in ${name} record ${index + 1}.`);
          }
          record[key] = new Date(field);
        } else if (column.dataType === 'number') {
          if (typeof field !== 'number' || !Number.isFinite(field)) {
            throw new BackupFormatError(`Invalid ${key} in ${name} record ${index + 1}.`);
          }
          record[key] = field;
        } else if (column.dataType === 'boolean') {
          if (typeof field !== 'boolean')
            throw new BackupFormatError(`Invalid ${key} in ${name} record ${index + 1}.`);
          record[key] = field;
        } else {
          if (typeof field !== 'string')
            throw new BackupFormatError(`Invalid ${key} in ${name} record ${index + 1}.`);
          record[key] = field;
        }
      }
      return record;
    });
  }
  return { schemaVersion: value.schemaVersion, exportedAt: value.exportedAt, rows, totalRecords };
}
