'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/** Keep an open cloud page current when another device saves a change. */
export function CloudRefresh() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (window.location.protocol !== 'https:') return;
    let lastRefresh = Date.now();
    const refresh = () => {
      if (Date.now() - lastRefresh < 60_000) return;
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
    const onFocus = () => refresh();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', onVisibility);
    const interval = window.setInterval(refresh, 60_000);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(interval);
    };
  }, [router, pathname]);

  return null;
}
