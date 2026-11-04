import { addInterviewPracticeAction } from '@/lib/actions/evidence-actions';
import { ActionForm } from './action-form';

const field = 'mt-1.5 min-h-11 w-full rounded-lg border bg-background px-3 text-sm font-normal';
const label = 'block text-sm font-semibold text-foreground';

export function InterviewPracticeForm({ today }: { today: string }) {
  return (
    <ActionForm
      action={addInterviewPracticeAction}
      submitLabel="Save practice"
      showSuccess={false}
      successConfirmation="Practice recorded"
      className="mt-4 grid max-w-3xl gap-x-4 gap-y-5 sm:grid-cols-2"
    >
      <label className={label}>
        Date
        <input
          type="date"
          name="date"
          defaultValue={today}
          max={today}
          required
          className={field}
        />
      </label>
      <label className={label}>
        Target role
        <select name="roleTrack" defaultValue="SE" className={field}>
          <option value="SE">SE</option>
          <option value="AI">AI</option>
          <option value="DevOps">DevOps</option>
          <option value="QA">QA</option>
        </select>
      </label>
      <label className={label}>
        Topic
        <input
          name="topic"
          required
          maxLength={160}
          placeholder="e.g. SQL joins"
          className={field}
        />
      </label>
      <label className={label}>
        Practice type
        <select name="type" defaultValue="mock" className={field}>
          <option value="mock">Mock interview</option>
          <option value="technical_question">Technical question</option>
          <option value="coding">Coding</option>
          <option value="explanation">Project explanation</option>
        </select>
      </label>
      <label className={label}>
        Minutes
        <input
          type="number"
          name="durationMinutes"
          min="1"
          max="1440"
          required
          placeholder="e.g. 30"
          className={field}
        />
      </label>
    </ActionForm>
  );
}
