'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Keep an open cloud page current when another device saves a change. */
export function CloudRefresh() {
  const router = useRouter();

  useEffect(() => {
    if (window.location.protocol !== 'https:') return;
    const refresh = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) router.refresh();
    };
    const onFocus = () => refresh();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', onVisibility);
    const interval = window.setInterval(refresh, 15000);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(interval);
    };
  }, [router]);

  return null;
}
