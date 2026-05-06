// Pure reconcile logic for schedule edits. Given the old next_occurrences,
// new next_occurrences, and the set of already-materialized task_instances,
// decide which pending future instances need to be deleted.
//
// Rules (these are tested):
//   - Past dates (< today) are never touched on either side.
//   - Instances with status != 'pending' are never deleted, regardless of
//     whether their date is still in newOccurrences.
//   - A pending future instance whose scheduled_for is no longer in
//     newOccurrences is deleted.
//   - Dates in newOccurrences that have no corresponding instance are simply
//     left for the cron generator to materialize on its next run.

export interface ExistingInstance {
  id: string;
  scheduledFor: string; // yyyy-MM-dd
  status: "pending" | "in_progress" | "completed" | "skipped";
}

export interface ReconcileResult {
  toDeleteIds: string[];
  unchangedIds: string[];
  pendingDatesAlreadyExist: string[];
  newDatesNeedingInstances: string[];
}

export function reconcileSchedule(opts: {
  existing: ExistingInstance[];
  newOccurrences: string[];
  today: string;
}): ReconcileResult {
  const { existing, newOccurrences, today } = opts;
  const newSet = new Set(newOccurrences);

  const toDeleteIds: string[] = [];
  const unchangedIds: string[] = [];
  const pendingDatesAlreadyExist: string[] = [];

  for (const inst of existing) {
    // Past instances are immutable.
    if (inst.scheduledFor < today) {
      unchangedIds.push(inst.id);
      continue;
    }
    // Non-pending status (in_progress/completed/skipped) is also immutable.
    if (inst.status !== "pending") {
      unchangedIds.push(inst.id);
      continue;
    }
    // Future pending: keep iff still in newOccurrences.
    if (newSet.has(inst.scheduledFor)) {
      unchangedIds.push(inst.id);
      pendingDatesAlreadyExist.push(inst.scheduledFor);
    } else {
      toDeleteIds.push(inst.id);
    }
  }

  const existingFutureSet = new Set(pendingDatesAlreadyExist);
  const newDatesNeedingInstances = newOccurrences.filter(
    (d) => d >= today && !existingFutureSet.has(d),
  );

  return {
    toDeleteIds,
    unchangedIds,
    pendingDatesAlreadyExist,
    newDatesNeedingInstances,
  };
}
