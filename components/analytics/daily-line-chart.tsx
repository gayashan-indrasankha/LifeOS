'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DailyProgress } from '@/types';

interface DailyLineChartProps {
  data: DailyProgress[];
}

const CHART_TITLE = 'Daily Progress';

export function DailyLineChart({ data }: DailyLineChartProps) {
  const chartData = data
    .filter((d) => d.total > 0)
    .map((d) => ({
      day: d.date.slice(8), // day number
      rate: d.rate,
    }));

  if (chartData.length === 0) {
    return (
      <Card className="analytics-card min-w-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">{CHART_TITLE}</CardTitle>
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
        <CardTitle className="text-sm font-medium">{CHART_TITLE}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-52 w-full min-w-0 sm:h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
                width={38}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                formatter={(value) => [`${value ?? 0}%`, 'Rate']}
                contentStyle={{
                  background: 'var(--popover)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: 12,
                }}
              />
              <Line
                isAnimationActive={false}
                type="monotone"
                dataKey="rate"
                stroke="var(--primary)"
                strokeWidth={2}
                dot={chartData.length === 1 ? { r: 4 } : false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
