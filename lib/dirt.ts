// Mirrors the Postgres compute_dirt_level function in JS for client-side
// previews. Keep this in lockstep with supabase/migrations/0011_template_cadence.sql.

export type DirtLevel = 0 | 1 | 2 | 3 | 4;

export interface TemplateCleanState {
  // Per-template cadence; if null, callers should pass `areaCadenceDays` as fallback.
  cadenceDays: number;
  lastCompletedAt: Date | null;
}

function ratioToLevel(ratio: number): DirtLevel {
  if (ratio < 0.5) return 0;
  if (ratio < 1.0) return 1;
  if (ratio < 1.5) return 2;
  if (ratio < 2.5) return 3;
  return 4;
}

function ratioFor(template: TemplateCleanState, now: Date): number {
  if (!template.lastCompletedAt) return 999;
  const daysSince =
    (now.getTime() - template.lastCompletedAt.getTime()) /
    (1000 * 60 * 60 * 24);
  return daysSince / template.cadenceDays;
}

// Area dirt level = max ratio across all templates in the area.
// Empty templates list → 4 (matches SQL's coalesce(..., 999) fallback).
export function computeDirtLevel(
  templates: TemplateCleanState[],
  now: Date = new Date(),
): DirtLevel {
  if (templates.length === 0) return 4;
  const maxRatio = Math.max(...templates.map((t) => ratioFor(t, now)));
  return ratioToLevel(maxRatio);
}
