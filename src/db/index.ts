// Legacy Drizzle/libsql database removed. This module remains as a stub.
export function getDb(): never {
  throw new Error('Legacy database removed. Use Supabase clients instead.');
}

export type Database = never;

export async function ensureAuthReady(): Promise<void> {
  // no-op
}