// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createChangeHub, type ListenerFactory } from '@/lib/realtime/change-hub';

function fakeListener() {
  const state = {
    opened: 0,
    closed: 0,
    notify: (() => {}) as (payload: string) => void,
    reconnect: () => {},
  };
  const factory: ListenerFactory = async (onNotify, onListen) => {
    state.opened++;
    state.notify = onNotify;
    state.reconnect = onListen;
    onListen();
    return {
      unlisten: async () => {},
      end: async () => {
        state.closed++;
      },
    };
  };
  return { state, factory };
}

const handlers = () => ({ change: vi.fn(), resync: vi.fn() });
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('realtime change hub', () => {
  it('shares one listener and delivers each change only to its owner', async () => {
    const { state, factory } = fakeListener();
    const hub = createChangeHub(factory);
    const [alice, alicePhone, bob] = [handlers(), handlers(), handlers()];
    await Promise.all([
      hub.subscribe('alice', alice),
      hub.subscribe('alice', alicePhone),
      hub.subscribe('bob', bob),
    ]);
    expect(state.opened).toBe(1);

    const payload = JSON.stringify({ userId: 'alice', table: 'tasks' });
    state.notify(payload);
    state.notify('not json');
    expect(alice.change).toHaveBeenCalledWith(payload);
    expect(alicePhone.change).toHaveBeenCalledWith(payload);
    expect(bob.change).not.toHaveBeenCalled();

    state.reconnect();
    expect(bob.resync).toHaveBeenCalled();
  });

  it('closes the connection after the last stream leaves and reopens on demand', async () => {
    const { state, factory } = fakeListener();
    const hub = createChangeHub(factory);
    const first = await hub.subscribe('alice', handlers());
    const second = await hub.subscribe('bob', handlers());
    first();
    first();
    await flush();
    expect(state.closed).toBe(0);
    second();
    await flush();
    expect(state.closed).toBe(1);
    expect(hub.subscriberCount()).toBe(0);

    await hub.subscribe('alice', handlers());
    expect(state.opened).toBe(2);
  });

  it('drops subscribers and retries after a failed connection', async () => {
    let attempts = 0;
    const hub = createChangeHub(async () => {
      if (++attempts === 1) throw new Error('offline');
      return { unlisten: async () => {}, end: async () => {} };
    });
    await expect(hub.subscribe('alice', handlers())).rejects.toThrow('offline');
    expect(hub.subscriberCount()).toBe(0);
    await hub.subscribe('alice', handlers());
    expect(attempts).toBe(2);
  });
});
