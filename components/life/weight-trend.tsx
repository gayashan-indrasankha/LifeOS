'use client';

import { useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export function WeightTrend({
  points,
  target,
}: {
  points: { date: string; value: number }[];
  target: number | null;
}) {
  const [compactAxis, setCompactAxis] = useState(false);
  if (!points.length) return <p className="text-sm text-muted-foreground">No measurements yet.</p>;
  const data = points.map((point) => ({ ...point, target }));
  return (
    <div
      className="h-56 w-full min-w-0"
      role="img"
      aria-label={`Recorded body weight from ${points[0].date} to ${points.at(-1)!.date}${target == null ? '' : `, target ${target} kg`}`}
    >
      <ResponsiveContainer
        width="100%"
        height="100%"
        onResize={(width) => setCompactAxis(width < 360)}
      >
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10 }}
            tickFormatter={(date: string) => (compactAxis ? date.slice(5) : date)}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis
            domain={['dataMin - 1', 'dataMax + 1']}
            tick={{ fontSize: 10 }}
            unit="kg"
            width={48}
          />
          <Tooltip
            formatter={(value, name) => [
              `${Number(value).toFixed(1)} kg`,
              name === 'value' ? 'Recorded daily mean' : 'Target',
            ]}
          />
          <Line type="linear" dataKey="value" stroke="var(--primary)" strokeWidth={2} dot />
          {target != null && (
            <Line
              type="linear"
              dataKey="target"
              stroke="#94a3b8"
              strokeDasharray="4 4"
              dot={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
