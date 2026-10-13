'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const POLL_INTERVAL_MS = 15_000;
const MIN_REFRESH_GAP_MS = 2_000;

/** Keep the Android cloud WebView current without reloading the whole page. */
export function AndroidCloudRefresh() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (window.location.protocol !== 'https:') return;
    if ('__lifeosAndroidSync' in window) return;
    let lastRefresh = Date.now();
    const refresh = () => {
      if ('__lifeosRealtimeConnected' in window && window.__lifeosRealtimeConnected) return;
      if (Date.now() - lastRefresh < MIN_REFRESH_GAP_MS) return;
      if (document.visibilityState !== 'visible' || !navigator.onLine) return;
      const active = document.activeElement;
      if (
        active instanceof HTMLElement &&
        active.matches('input, textarea, select, [contenteditable]')
      )
        return;
      lastRefresh = Date.now();
      router.refresh();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    window.addEventListener('lifeos:android-resume', refresh);
    document.addEventListener('visibilitychange', onVisible);
    const interval = window.setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      window.removeEventListener('lifeos:android-resume', refresh);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(interval);
    };
  }, [router, pathname]);

  return null;
}
