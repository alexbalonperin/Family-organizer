import { describe, expect, it } from "vitest";
import { reconcileSchedule } from "@/lib/rrule/reconcile";

const today = "2026-05-06";

describe("reconcileSchedule", () => {
  it("never deletes past instances regardless of new occurrences", () => {
    const r = reconcileSchedule({
      existing: [
        { id: "a", scheduledFor: "2026-04-01", status: "pending" },
        { id: "b", scheduledFor: "2026-04-15", status: "pending" },
      ],
      newOccurrences: [],
      today,
    });
    expect(r.toDeleteIds).toEqual([]);
    expect(r.unchangedIds.sort()).toEqual(["a", "b"]);
  });

  it("never deletes completed/in_progress/skipped instances", () => {
    const r = reconcileSchedule({
      existing: [
        { id: "c", scheduledFor: "2026-05-12", status: "completed" },
        { id: "p", scheduledFor: "2026-05-12", status: "in_progress" },
        { id: "s", scheduledFor: "2026-05-12", status: "skipped" },
      ],
      newOccurrences: [], // dropped from schedule entirely
      today,
    });
    expect(r.toDeleteIds).toEqual([]);
    expect(r.unchangedIds.sort()).toEqual(["c", "p", "s"]);
  });

  it("deletes pending future instances on dropped dates", () => {
    const r = reconcileSchedule({
      existing: [
        { id: "tue1", scheduledFor: "2026-05-12", status: "pending" }, // tue
        { id: "tue2", scheduledFor: "2026-05-19", status: "pending" }, // tue
      ],
      newOccurrences: ["2026-05-13", "2026-05-20"], // moved to wed
      today,
    });
    expect(r.toDeleteIds.sort()).toEqual(["tue1", "tue2"]);
    expect(r.newDatesNeedingInstances).toEqual([
      "2026-05-13",
      "2026-05-20",
    ]);
  });

  it("keeps pending future instances whose date is still in newOccurrences", () => {
    const r = reconcileSchedule({
      existing: [
        { id: "keep", scheduledFor: "2026-05-15", status: "pending" },
      ],
      newOccurrences: ["2026-05-15", "2026-05-22"],
      today,
    });
    expect(r.toDeleteIds).toEqual([]);
    expect(r.unchangedIds).toEqual(["keep"]);
    expect(r.newDatesNeedingInstances).toEqual(["2026-05-22"]);
  });

  it("mixed: keeps past, keeps completed, deletes dropped pending, marks new dates", () => {
    const r = reconcileSchedule({
      existing: [
        { id: "past", scheduledFor: "2026-04-30", status: "pending" },
        { id: "completed-on-old", scheduledFor: "2026-05-12", status: "completed" },
        { id: "pending-on-old", scheduledFor: "2026-05-19", status: "pending" },
        { id: "pending-still", scheduledFor: "2026-05-13", status: "pending" },
      ],
      newOccurrences: ["2026-05-13", "2026-05-20"], // tue→wed move
      today,
    });
    expect(r.toDeleteIds).toEqual(["pending-on-old"]);
    expect(r.unchangedIds.sort()).toEqual([
      "completed-on-old",
      "past",
      "pending-still",
    ]);
    expect(r.newDatesNeedingInstances).toEqual(["2026-05-20"]);
  });

  it("today counts as future (not deleted)", () => {
    const r = reconcileSchedule({
      existing: [{ id: "today", scheduledFor: today, status: "pending" }],
      newOccurrences: [today],
      today,
    });
    expect(r.toDeleteIds).toEqual([]);
    expect(r.unchangedIds).toEqual(["today"]);
  });
});
