// @vitest-environment-options {"url":"https://lifeos.test"}
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AndroidCloudRefresh } from '@/components/providers/android-cloud-refresh';

const refresh = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  refresh.mockReset();
});

it('uses one fallback refresh and coalesces Android resume events', () => {
  vi.useFakeTimers();
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  const close = vi.fn();
  const source = vi.fn(function () {
    return { addEventListener: vi.fn(), close, onopen: null, onerror: null };
  });
  vi.stubGlobal('EventSource', source);
  const view = render(<AndroidCloudRefresh />);
  expect(source).toHaveBeenCalledOnce();
  act(() => {
    vi.advanceTimersByTime(15050);
  });
  expect(refresh).toHaveBeenCalledTimes(1);
  act(() => {
    vi.advanceTimersByTime(3000);
    window.dispatchEvent(new Event('lifeos:android-resume'));
    window.dispatchEvent(new Event('focus'));
    vi.advanceTimersByTime(50);
  });
  expect(refresh).toHaveBeenCalledTimes(2);
  view.unmount();
  expect(close).toHaveBeenCalledOnce();
  act(() => {
    vi.advanceTimersByTime(30000);
  });
  expect(refresh).toHaveBeenCalledTimes(2);
});
