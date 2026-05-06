import { describe, expect, it } from "vitest";
import { computeDirtLevel } from "@/lib/dirt";

describe("computeDirtLevel", () => {
  const now = new Date("2026-05-06T12:00:00Z");
  const daysAgo = (days: number) =>
    new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  it("returns 4 when an area has no templates", () => {
    expect(computeDirtLevel([], now)).toBe(4);
  });

  it("returns 4 when no template has ever been completed", () => {
    expect(
      computeDirtLevel(
        [
          { cadenceDays: 1, lastCompletedAt: null },
          { cadenceDays: 7, lastCompletedAt: null },
        ],
        now,
      ),
    ).toBe(4);
  });

  it("returns the level of the worst-overdue template (vacuum vs wet-wipe)", () => {
    // Vacuum (daily) done today → ratio 0 → level 0
    // Wet-wipe (weekly) done 14 days ago → ratio 2.0 → level 3
    expect(
      computeDirtLevel(
        [
          { cadenceDays: 1, lastCompletedAt: daysAgo(0) },
          { cadenceDays: 7, lastCompletedAt: daysAgo(14) },
        ],
        now,
      ),
    ).toBe(3);
  });

  it("returns 0 when every template is comfortably within cadence", () => {
    expect(
      computeDirtLevel(
        [
          { cadenceDays: 2, lastCompletedAt: daysAgo(0.5) },
          { cadenceDays: 7, lastCompletedAt: daysAgo(2) },
        ],
        now,
      ),
    ).toBe(0);
  });

  it("classifies the bucket boundaries correctly for a single template", () => {
    const single = (lastDays: number) =>
      computeDirtLevel(
        [{ cadenceDays: 2, lastCompletedAt: daysAgo(lastDays) }],
        now,
      );
    expect(single(0.5)).toBe(0); // ratio 0.25
    expect(single(1.5)).toBe(1); // ratio 0.75
    expect(single(2.5)).toBe(2); // ratio 1.25
    expect(single(4)).toBe(3); // ratio 2.0
    expect(single(20)).toBe(4); // ratio 10.0
  });
});
