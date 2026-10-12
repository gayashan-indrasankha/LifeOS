import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { parseServerEnv } from '@/lib/env';

const env = parseServerEnv(process.env);

// Share one pool across route chunks and development reloads. The embedded socket
// multiplexes one PGlite connection and needs requests to use the same pool.
const globalForDb = globalThis as unknown as {
  connection: postgres.Sql | undefined;
};

const connection =
  globalForDb.connection ??
  postgres(env.DATABASE_URL, {
    // Cloud pages issue independent reads in parallel. A single connection
    // serializes every read across a transcontinental round trip.
    max:
      process.env.HABITFLOW_EMBEDDED_DB === '1'
        ? 1
        : process.env.NODE_ENV === 'production'
          ? 5
          : 10,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 20,
  });

globalForDb.connection = connection;

export const db = drizzle(connection, { schema });
export type DB = typeof db;
