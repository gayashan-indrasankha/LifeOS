'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CompletionStats } from '@/types';

interface CompletionDonutProps {
  stats: CompletionStats;
}

export function CompletionDonut({ stats }: CompletionDonutProps) {
  const remaining = Math.max(0, stats.total - stats.completed);
  const data = [
    { name: 'Completed', value: stats.completed },
    { name: 'Remaining', value: remaining },
  ];

  const COLORS = ['var(--primary)', 'var(--muted)'];

  if (stats.total === 0) {
    return (
      <Card className="analytics-card min-w-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Scheduled habit check-ins</CardTitle>
        </CardHeader>
        <CardContent className="flex h-48 items-center justify-center">
          <p className="text-sm text-muted-foreground">No data yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="analytics-card min-w-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Scheduled habit check-ins</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative h-48 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={46}
                outerRadius={66}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
                startAngle={90}
                endAngle={-270}
              >
                {data.map((_, index) => (
                  <Cell key={index} fill={COLORS[index]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [value ?? 0, String(name)]}
                contentStyle={{
                  background: 'var(--popover)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {stats.completed}/{stats.total}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
