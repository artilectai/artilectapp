// BetterAuth server removed. Use Supabase clients instead.
// This module remains only to avoid broken imports during migration.

export function getAuth(): never {
  throw new Error('BetterAuth has been removed. Use Supabase auth.');
}

export async function getCurrentUser(): Promise<never> {
  throw new Error('BetterAuth has been removed. Use Supabase auth.');
}
