import { describe, expect, it } from "vitest";
import { pickAssignee } from "@/lib/assignment/pick";

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
const C = "00000000-0000-0000-0000-00000000000c";

describe("pickAssignee", () => {
  describe("fixed", () => {
    it("always picks the first assignee", () => {
      const r = pickAssignee({
        policy: "fixed",
        assigneeUserIds: [A, B, C],
        lastAssignedUserId: B,
      });
      expect(r.userId).toBe(A);
      expect(r.newCursorUserId).toBe(B);
    });
  });

  describe("round_robin", () => {
    it("starts with the first user when no cursor", () => {
      const r = pickAssignee({
        policy: "round_robin",
        assigneeUserIds: [A, B, C],
        lastAssignedUserId: null,
      });
      expect(r.userId).toBe(A);
      expect(r.newCursorUserId).toBe(A);
    });

    it("advances past the cursor", () => {
      const r = pickAssignee({
        policy: "round_robin",
        assigneeUserIds: [A, B, C],
        lastAssignedUserId: A,
      });
      expect(r.userId).toBe(B);
      expect(r.newCursorUserId).toBe(B);
    });

    it("wraps around at the end", () => {
      const r = pickAssignee({
        policy: "round_robin",
        assigneeUserIds: [A, B, C],
        lastAssignedUserId: C,
      });
      expect(r.userId).toBe(A);
      expect(r.newCursorUserId).toBe(A);
    });

    it("treats unknown cursor as start of pool", () => {
      const r = pickAssignee({
        policy: "round_robin",
        assigneeUserIds: [A, B],
        lastAssignedUserId: "deadbeef",
      });
      expect(r.userId).toBe(A);
    });
  });

  describe("load_balanced", () => {
    it("picks the user with fewest recent counts", () => {
      const r = pickAssignee({
        policy: "load_balanced",
        assigneeUserIds: [A, B, C],
        lastAssignedUserId: null,
        recentCounts: { [A]: 3, [B]: 1, [C]: 2 },
      });
      expect(r.userId).toBe(B);
    });

    it("breaks ties by user id (lex)", () => {
      const r = pickAssignee({
        policy: "load_balanced",
        assigneeUserIds: [C, A, B], // out of order intentionally
        lastAssignedUserId: null,
        recentCounts: { [A]: 0, [B]: 0, [C]: 0 },
      });
      // a < b < c lexicographically
      expect(r.userId).toBe(A);
    });

    it("missing counts default to 0", () => {
      const r = pickAssignee({
        policy: "load_balanced",
        assigneeUserIds: [A, B, C],
        lastAssignedUserId: null,
        recentCounts: { [A]: 5 },
      });
      // Both B and C are 0; B < C so pick B.
      expect(r.userId).toBe(B);
    });
  });

  it("throws on empty pool", () => {
    expect(() =>
      pickAssignee({
        policy: "fixed",
        assigneeUserIds: [],
        lastAssignedUserId: null,
      }),
    ).toThrow();
  });
});
