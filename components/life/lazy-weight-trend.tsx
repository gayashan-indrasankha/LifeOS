'use client';

import dynamic from 'next/dynamic';

const WeightTrend = dynamic(() =>
  import('@/components/life/weight-trend').then((module) => module.WeightTrend),
);

export function LazyWeightTrend({
  points,
  target,
}: {
  points: { date: string; value: number }[];
  target: number | null;
}) {
  return <WeightTrend points={points} target={target} />;
}
