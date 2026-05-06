// JS-side mirror of the assignment policies in
// supabase/migrations/0006_generate_instances.sql. Used in unit tests and
// available for ad-hoc Server Action assignments. Keep behavior in lockstep
// with the SQL.

export type Policy = "fixed" | "round_robin" | "load_balanced";

export interface PickInput {
  policy: Policy;
  assigneeUserIds: string[];
  lastAssignedUserId: string | null;
  // For load_balanced: count of (pending + completed) instances per user in
  // the last 7 days. Missing users default to 0.
  recentCounts?: Record<string, number>;
}

export interface PickResult {
  userId: string;
  newCursorUserId: string | null; // For round_robin, the new last_assigned_user_id.
}

export function pickAssignee(input: PickInput): PickResult {
  const pool = input.assigneeUserIds;
  if (pool.length === 0) {
    throw new Error("No assignees in pool");
  }

  if (input.policy === "fixed") {
    return { userId: pool[0], newCursorUserId: input.lastAssignedUserId };
  }

  if (input.policy === "round_robin") {
    const lastIdx = input.lastAssignedUserId
      ? pool.indexOf(input.lastAssignedUserId)
      : -1;
    const nextIdx = (lastIdx + 1) % pool.length;
    const next = pool[nextIdx];
    return { userId: next, newCursorUserId: next };
  }

  // load_balanced: pick user with fewest recent count, ties broken by user id
  // (lexicographic — same as SQL `ORDER BY count, user_id`).
  const counts = input.recentCounts ?? {};
  const sorted = [...pool].sort((a, b) => {
    const ca = counts[a] ?? 0;
    const cb = counts[b] ?? 0;
    if (ca !== cb) return ca - cb;
    return a < b ? -1 : a > b ? 1 : 0;
  });
  return { userId: sorted[0], newCursorUserId: input.lastAssignedUserId };
}
