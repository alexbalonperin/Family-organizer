// Mirrors the Postgres compute_dirt_level function in JS for client-side
// previews on the area edit page. Keep this in lockstep with
// supabase/migrations/0005_dirt.sql.

export type DirtLevel = 0 | 1 | 2 | 3 | 4;

export function computeDirtLevel(
  expectedCadenceDays: number,
  lastCleanedAt: Date | null,
  now: Date = new Date(),
): DirtLevel {
  if (!lastCleanedAt) return 4;
  const daysSince =
    (now.getTime() - lastCleanedAt.getTime()) / (1000 * 60 * 60 * 24);
  const ratio = daysSince / expectedCadenceDays;
  if (ratio < 0.5) return 0;
  if (ratio < 1.0) return 1;
  if (ratio < 1.5) return 2;
  if (ratio < 2.5) return 3;
  return 4;
}
