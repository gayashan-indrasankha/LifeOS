'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { WeeklySummary } from '@/types';

interface WeeklyBarChartProps {
  data: WeeklySummary[];
}

export function WeeklyBarChart({ data }: WeeklyBarChartProps) {
  const hasScheduledCheckIns = data.some((week) => week.total > 0);

  return (
    <Card className="analytics-card min-w-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          Scheduled habit check-ins · last 8 weeks
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasScheduledCheckIns ? (
          <div className="flex h-36 items-center justify-center text-center">
            <p className="text-sm text-muted-foreground">
              No scheduled habit check-ins in these eight weeks
            </p>
          </div>
        ) : (
          <div
            className="themed-scrollbar w-full min-w-0 overflow-x-auto"
            tabIndex={0}
            aria-label="Scroll weekly habit chart horizontally"
          >
            <div
              className="h-52 w-full min-w-0 sm:h-44 sm:min-w-[560px]"
              role="img"
              aria-label="Scheduled habit check-in rate for the last eight weeks"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data}
                  margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                  barCategoryGap="12%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="weekLabel"
                    interval="preserveStartEnd"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 100]}
                    width={38}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    cursor={false}
                    formatter={(value, _name, item) => [
                      `${item.payload.completed}/${item.payload.total} completed (${value ?? 0}%)`,
                      'Check-ins',
                    ]}
                    contentStyle={{
                      background: 'var(--popover)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="rate" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={72} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
