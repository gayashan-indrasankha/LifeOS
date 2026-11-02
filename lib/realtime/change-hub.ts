import postgres from 'postgres';

export type ChangeHandlers = {
  change: (payload: string) => void;
  resync: () => void;
};

type Listener = {
  unlisten: () => Promise<void>;
  end: () => Promise<void>;
};

export type ListenerFactory = (
  onNotify: (payload: string) => void,
  onListen: () => void,
) => Promise<Listener>;

function directDatabaseUrl() {
  const value = process.env.REALTIME_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!value) throw new Error('A database URL is required for real-time updates.');
  const url = new URL(value);
  url.hostname = url.hostname.replace(/-pooler(?=\.)/, '');
  return url.toString();
}

const postgresListener: ListenerFactory = async (onNotify, onListen) => {
  const sql = postgres(directDatabaseUrl(), {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 0,
  });
  try {
    const { unlisten } = await sql.listen('lifeos_changes', onNotify, onListen);
    return { unlisten, end: () => sql.end() };
  } catch (error) {
    await sql.end();
    throw error;
  }
};

/**
 * Fans one LISTEN connection out to every open stream in this server process,
 * so connected devices do not each hold a database connection.
 */
export function createChangeHub(factory: ListenerFactory) {
  const subscribers = new Map<string, Set<ChangeHandlers>>();
  let listener: Promise<Listener> | null = null;

  const each = (visit: (handlers: ChangeHandlers) => void) => {
    for (const set of subscribers.values()) for (const handlers of set) visit(handlers);
  };

  const onNotify = (payload: string) => {
    let userId: string | undefined;
    try {
      userId = (JSON.parse(payload) as { userId?: string }).userId;
    } catch {
      // Ignore malformed notifications instead of closing healthy streams.
      return;
    }
    if (!userId) return;
    for (const handlers of subscribers.get(userId) ?? []) handlers.change(payload);
  };

  // postgres.js calls this after every (re)connect; changes may have been missed.
  const onListen = () => each((handlers) => handlers.resync());

  const releaseIfIdle = () => {
    if (subscribers.size || !listener) return;
    const current = listener;
    listener = null;
    void current
      .then(async (active) => {
        try {
          await active.unlisten();
        } finally {
          await active.end();
        }
      })
      .catch(() => {
        // The connection already failed or closed.
      });
  };

  return {
    /** Resolves once listening; the returned function removes this subscriber. */
    async subscribe(userId: string, handlers: ChangeHandlers): Promise<() => void> {
      const set = subscribers.get(userId) ?? new Set();
      set.add(handlers);
      subscribers.set(userId, set);
      const current = (listener ??= factory(onNotify, onListen));
      let removed = false;
      const unsubscribe = () => {
        if (removed) return;
        removed = true;
        set.delete(handlers);
        if (!set.size && subscribers.get(userId) === set) subscribers.delete(userId);
        releaseIfIdle();
      };
      try {
        await current;
      } catch (error) {
        if (listener === current) listener = null;
        removed = true;
        set.delete(handlers);
        if (!set.size && subscribers.get(userId) === set) subscribers.delete(userId);
        throw error;
      }
      return unsubscribe;
    },
    subscriberCount() {
      let count = 0;
      each(() => count++);
      return count;
    },
  };
}

const globalForHub = globalThis as unknown as {
  lifeosChangeHub: ReturnType<typeof createChangeHub> | undefined;
};

// Shared across route chunks and development reloads, like the database pool.
export const changeHub = (globalForHub.lifeosChangeHub ??= createChangeHub(postgresListener));
