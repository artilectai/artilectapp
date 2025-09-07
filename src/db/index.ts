import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from '@/db/schema';

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (_db) return _db;

  const url = process.env.TURSO_CONNECTION_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error('TURSO_CONNECTION_URL is not set');
  }

  // authToken can be optional for local setups; pass when present
  const client = createClient({ url, authToken });
  _db = drizzle(client, { schema });
  return _db;
}

export type Database = ReturnType<typeof getDb>;