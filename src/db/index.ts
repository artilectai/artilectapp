import { drizzle } from 'drizzle-orm/libsql';
import { createClient, Client } from '@libsql/client';
import * as schema from '@/db/schema';

let _db: ReturnType<typeof drizzle> | null = null;
let _client: Client | null = null;
let _initPromise: Promise<void> | null = null;

export function getDb() {
  if (_db) return _db;

  const url = process.env.TURSO_CONNECTION_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    // During builds or local dev without Turso, use a safe fallback to avoid crashes.
    const fallbackUrl = process.env.NODE_ENV === 'production'
      ? 'file::memory:'
      : 'file:dev.db';
    _client = createClient({ url: fallbackUrl });
    _db = drizzle(_client, { schema });
    return _db;
  }

  // authToken can be optional for local setups; pass when present
  _client = createClient({ url, authToken });
  _db = drizzle(_client, { schema });
  return _db;
}

export type Database = ReturnType<typeof getDb>;

// Optional: ensure BetterAuth tables exist in fallback databases (e.g., in-memory)
export async function ensureAuthReady() {
  if (_initPromise) return _initPromise;
  // Make sure client/db are created
  getDb();
  if (!_client) return; // nothing to do

  const ddl = `
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS "user" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL UNIQUE,
    "phone" TEXT,
    "email_verified" INTEGER NOT NULL DEFAULT 0,
    "image" TEXT,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS "session" (
    "id" TEXT PRIMARY KEY,
    "expires_at" INTEGER NOT NULL,
    "token" TEXT NOT NULL UNIQUE,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "user_id" TEXT NOT NULL,
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS "account" (
    "id" TEXT PRIMARY KEY,
    "account_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "id_token" TEXT,
    "access_token_expires_at" INTEGER,
    "refresh_token_expires_at" INTEGER,
    "scope" TEXT,
    "password" TEXT,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS "verification" (
    "id" TEXT PRIMARY KEY,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" INTEGER NOT NULL,
    "created_at" INTEGER,
    "updated_at" INTEGER
  );
  `;

  _initPromise = _client.executeMultiple(ddl).then(() => undefined).catch(() => undefined);
  return _initPromise;
}