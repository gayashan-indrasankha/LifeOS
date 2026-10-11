export const PRESET_ID = 'personal-life-os';
export const PRESET_VERSION = 3;

export const sectionLabels = {
  university: 'University',
  industry: 'UCSC Industry Project',
  career: 'Software Engineering and DevOps',
  interview: 'Interview preparation',
  english: 'English communication',
  fitness: 'Fitness and recovery',
  nutrition: 'Optional nutrition plan',
  recovery: 'Reading, meditation, sleep and focus',
} as const;
export type Section = keyof typeof sectionLabels;

type Item = { key: string; section: Section; name: string };
export type GoalPreset = Item & {
  area: string;
  description?: string;
  targetValue?: number;
  targetUnit?: string;
};
export type ProjectPreset = Item & { goal: string; type: string };
export type TaskPreset = Item & {
  goal?: string;
  project?: string;
  milestone?: boolean;
  details?: string;
};
export type HabitPreset = Item & {
  category: string;
  schedule: string;
  target: number;
  description?: string;
};
export type TopicPreset = Item & { category: string; track: 'Shared' | 'SE' | 'DevOps' };
export type MealPreset = Item & { order: number; notes?: string };

export const goals: GoalPreset[] = [
  {
    key: 'university',
    section: 'university',
    area: 'Education & Skills',
    name: 'Aim for A grades in five subjects',
    description:
      'Replace the five subject placeholders with your real subjects; enter grades only when known.',
  },
  {
    key: 'industry',
    section: 'industry',
    area: 'Career',
    name: 'Complete UCSC Industry Project successfully',
  },
  {
    key: 'se-portfolio',
    section: 'career',
    area: 'Career',
    name: 'Become ready for a Software Engineering internship',
  },
  {
    key: 'devops-portfolio',
    section: 'career',
    area: 'Career',
    name: 'Become ready for a DevOps internship',
  },
  {
    key: 'interviews',
    section: 'interview',
    area: 'Career',
    name: 'Prepare for SE and DevOps internship interviews',
  },
  {
    key: 'communication',
    section: 'english',
    area: 'Personal Development',
    name: 'Speak technical and professional English confidently',
  },
  {
    key: 'body-weight',
    section: 'fitness',
    area: 'Fitness',
    name: 'Work toward an 80 kg body-weight goal',
    targetValue: 80,
    targetUnit: 'kg',
    description: 'Set a personal target in Goals and record measured weight on Today.',
  },
  {
    key: 'sleep-recovery',
    section: 'recovery',
    area: 'Fitness',
    name: 'Protect sleep, attention and recovery',
  },
];

export const projects: ProjectPreset[] = [
  {
    key: 'industry-project',
    section: 'industry',
    goal: 'industry',
    type: 'UCSC Industry Project',
    name: 'UCSC Industry Project',
  },
  {
    key: 'se-project',
    section: 'career',
    goal: 'se-portfolio',
    type: 'Software Engineering Portfolio',
    name: 'Software Engineering Portfolio Project',
  },
  {
    key: 'devops-project',
    section: 'career',
    goal: 'devops-portfolio',
    type: 'DevOps Portfolio',
    name: 'DevOps Portfolio Project',
  },
];

function milestone(section: Section, project: string, names: string[]): TaskPreset[] {
  return names.map((name, index) => ({
    key: `${project}-milestone-${index + 1}`,
    section,
    project,
    name,
    milestone: true,
  }));
}
export const tasks: TaskPreset[] = [
  ...[
    'Review recent lecture material',
    'Practise active recall',
    'Solve past-paper questions',
    'Record weak topics',
    'Review upcoming assessments',
  ].map((name, index) => ({
    key: `academic-starter-${index + 1}`,
    section: 'university' as const,
    goal: 'university',
    name,
    details: 'Reusable starter suggestion; schedule or edit when relevant.',
  })),
  ...milestone('industry', 'industry-project', [
    'Confirm project scope and requirements',
    'Plan architecture and technical approach',
    'Set up repository and development environment',
    'Deliver core implementation',
    'Test and review deliverables',
    'Prepare documentation',
    'Prepare final demonstration',
  ]),
  ...milestone('career', 'se-project', [
    'Choose project scope',
    'Write requirements and acceptance criteria',
    'Set up Git repository and architecture',
    'Implement first end-to-end feature',
    'Implement necessary validation and security',
    'Add automated tests',
    'Document design decisions',
    'Prepare demonstration and deployment instructions',
    'Practise explaining technical trade-offs',
  ]),
  ...milestone('career', 'devops-project', [
    'Linux and networking fundamentals',
    'Containerize a real application',
    'Implement CI automation',
    'Understand cloud deployment basics',
    'Add Infrastructure-as-Code when appropriate',
    'Set up logging and monitoring',
    'Test failure and recovery behavior',
    'Document architecture and reproducible setup',
    'Prepare a technical demonstration',
  ]),
];

export const habits: HabitPreset[] = [
  {
    key: 'academic-recall',
    section: 'university',
    name: 'Academic active recall',
    category: 'Education & Skills',
    schedule: 'weekly:5',
    target: 20,
  },
  {
    key: 'english-daily',
    section: 'english',
    name: 'English speaking practice (20–30 min)',
    category: 'Personal Development',
    schedule: 'daily',
    target: 25,
  },
  {
    key: 'gym-4',
    section: 'fitness',
    name: 'Gym session',
    category: 'Fitness',
    schedule: 'custom:0110110',
    target: 16,
  },
  {
    key: 'weigh-in',
    section: 'fitness',
    name: 'Morning weight check reminder',
    category: 'Fitness',
    schedule: 'custom:1010100',
    target: 12,
    description: 'Record an actual weight separately; checking this reminder is not a measurement.',
  },
  {
    key: 'reading',
    section: 'recovery',
    name: 'Read 10 pages daily',
    category: 'Education & Skills',
    schedule: 'daily',
    target: 25,
  },
  {
    key: 'meditation',
    section: 'recovery',
    name: 'Meditate for 10 minutes',
    category: 'Personal Development',
    schedule: 'daily',
    target: 25,
  },
  {
    key: 'sleep-routine',
    section: 'recovery',
    name: 'Sleep routine: 23:00–06:30',
    category: 'Fitness',
    schedule: 'daily',
    target: 25,
    description: 'Plan bedtime and wake time; this is not an overnight time block.',
  },
  {
    key: 'phone-shutdown',
    section: 'recovery',
    name: 'Evening phone shutdown by 22:15',
    category: 'Personal Development',
    schedule: 'daily',
    target: 25,
  },
];

const shared = [
  'Programming fundamentals',
  'OOP',
  'Data structures',
  'SQL and databases',
  'Networking',
  'Operating systems',
  'Git',
  'REST APIs',
  'Testing',
  'Debugging',
];
const se = [
  'Algorithms',
  'Backend implementation',
  'API design',
  'Authentication and authorization',
  'Software architecture fundamentals',
];
const devops = [
  'Linux commands',
  'Docker',
  'CI/CD',
  'Cloud fundamentals',
  'Networking troubleshooting',
  'Monitoring and Infrastructure-as-Code',
];
export const topics: TopicPreset[] = [
  ...shared.map((name, index) => ({
    key: `interview-shared-${index + 1}`,
    section: 'interview' as const,
    category: 'Foundations',
    name,
    track: 'Shared' as const,
  })),
  ...se.map((name, index) => ({
    key: `interview-se-${index + 1}`,
    section: 'interview' as const,
    category: 'Software Engineering',
    name,
    track: 'SE' as const,
  })),
  ...devops.map((name, index) => ({
    key: `interview-devops-${index + 1}`,
    section: 'interview' as const,
    category: 'DevOps',
    name,
    track: 'DevOps' as const,
  })),
];

export const meals: MealPreset[] = [
  'Breakfast',
  'Lunch',
  'Pre-workout meal or snack',
  'Post-workout meal',
  'Dinner',
  'Before-bed milk or optional snack',
].map((name, order) => ({
  key: `meal-${order + 1}`,
  section: 'nutrition',
  name,
  order,
  notes: 'Add foods, portions, preferred time and optional planned macros when known.',
}));

export const presetItems = { goals, projects, tasks, habits, topics, meals } as const;
