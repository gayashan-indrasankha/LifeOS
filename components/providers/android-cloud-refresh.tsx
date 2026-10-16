'use client';

import { RealtimeSync } from './realtime-sync';

/** One stream and one fallback timer own Android refreshes, including resume. */
export function AndroidCloudRefresh() {
  return <RealtimeSync />;
}
