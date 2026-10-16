'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export type RealtimeChange = {
  userId: string;
  table: string;
  habitId?: string;
  date?: string;
  completed?: boolean;
};

type RealtimeWindow = Window & { __lifeosRealtimeConnected?: boolean };

/** Receive committed database changes and refresh the current server-rendered page. */
export function RealtimeSync() {
  const router = useRouter();

  useEffect(() => {
    if (window.location.protocol !== 'https:') return;
    const realtimeWindow = window as RealtimeWindow;
    const source = new EventSource('/api/realtime');
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let lastRefresh = 0;

    const refresh = () => {
      if (document.hidden || !navigator.onLine) return;
      if (refreshTimer) return;
      refreshTimer = setTimeout(() => {
        refreshTimer = undefined;
        lastRefresh = Date.now();
        router.refresh();
      }, 50);
    };

    source.onopen = () => {
      realtimeWindow.__lifeosRealtimeConnected = true;
    };
    source.onerror = () => {
      realtimeWindow.__lifeosRealtimeConnected = false;
    };
    source.addEventListener('change', (event) => {
      try {
        const change = JSON.parse((event as MessageEvent).data) as RealtimeChange;
        window.dispatchEvent(new CustomEvent('lifeos:realtime-change', { detail: change }));
      } catch {
        // The route refresh still reconciles the page if a payload is malformed.
      }
      refresh();
    });
    source.addEventListener('resync', refresh);
    const onVisible = () => {
      if (!document.hidden && Date.now() - lastRefresh > 2_000) refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    window.addEventListener('online', onVisible);
    window.addEventListener('lifeos:android-resume', onVisible);
    const fallback = setInterval(() => {
      if (!realtimeWindow.__lifeosRealtimeConnected && Date.now() - lastRefresh > 15_000) {
        refresh();
      }
    }, 15_000);

    return () => {
      source.close();
      realtimeWindow.__lifeosRealtimeConnected = false;
      if (refreshTimer) clearTimeout(refreshTimer);
      clearInterval(fallback);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('online', onVisible);
      window.removeEventListener('lifeos:android-resume', onVisible);
    };
  }, [router]);

  return null;
}
