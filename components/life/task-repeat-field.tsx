'use client';

import { useState } from 'react';

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function TaskRepeatField({
  initial = 'once',
  weekdays = null,
}: {
  initial?: string;
  weekdays?: string | null;
}) {
  const [repeat, setRepeat] = useState(initial);
  return (
    <div className="space-y-2 text-sm font-medium sm:col-span-2">
      <label className="block">
        Repeat
        <select
          name="recurrence"
          value={repeat}
          onChange={(event) => setRepeat(event.target.value)}
          className="mt-1.5 min-h-11 w-full rounded-lg border bg-background px-3 font-normal"
        >
          <option value="once">Complete once</option>
          <option value="daily">Every day</option>
          <option value="weekly">Selected weekdays</option>
        </select>
      </label>
      {repeat === 'weekly' && (
        <fieldset>
          <legend className="mb-2">Repeat on</legend>
          <input type="hidden" name="weekdaySelection" value="1" />
          <div className="flex flex-wrap gap-2">
            {days.map((day, index) => (
              <label
                key={day}
                className="flex min-h-10 items-center gap-1.5 rounded-lg border bg-background px-3"
              >
                <input
                  type="checkbox"
                  name="weekday"
                  value={index}
                  defaultChecked={weekdays?.[index] === '1'}
                />
                {day}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {repeat !== 'once' && (
        <p className="text-xs font-normal text-muted-foreground">
          Each scheduled day has its own completion. Start and end dates are required.
        </p>
      )}
      {repeat === 'once' && (
        <p className="text-xs font-normal text-muted-foreground">
          Shows each day from the start date until you mark it done once, stopping at the end date
          if set.
        </p>
      )}
    </div>
  );
}
