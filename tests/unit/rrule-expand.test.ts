import { describe, expect, it } from "vitest";
import {
  expandSchedule,
  buildWeeklyRrule,
  buildDailyRrule,
  isExpansionWindowLow,
} from "@/lib/rrule/expand";

const FROM = new Date("2026-05-04T00:00:00Z"); // Mon

describe("expandSchedule", () => {
  it("expands weekly Tue/Fri across 2 weeks", () => {
    const rrule = "DTSTART:20260501T050000\nRRULE:FREQ=WEEKLY;BYDAY=TU,FR";
    const dates = expandSchedule(rrule, FROM, 14);
    expect(dates).toContain("2026-05-05"); // tue
    expect(dates).toContain("2026-05-08"); // fri
    expect(dates).toContain("2026-05-12");
    expect(dates).toContain("2026-05-15");
    // No mondays or wednesdays.
    expect(dates).not.toContain("2026-05-04");
    expect(dates).not.toContain("2026-05-06");
  });

  it("expands daily over 7 days = 7 dates", () => {
    const rrule = buildDailyRrule(new Date("2026-05-04T00:00:00Z"));
    const dates = expandSchedule(rrule, FROM, 7);
    expect(dates).toHaveLength(7);
    expect(new Set(dates).size).toBe(7);
  });

  it("buildWeeklyRrule produces a valid string", () => {
    const rrule = buildWeeklyRrule({
      byDay: ["MO", "WE"],
      startDate: new Date("2026-05-04T00:00:00Z"),
    });
    expect(rrule).toContain("FREQ=WEEKLY");
    expect(rrule).toContain("BYDAY=MO,WE");
    const dates = expandSchedule(rrule, FROM, 14);
    expect(dates.length).toBeGreaterThanOrEqual(4);
  });
});

describe("isExpansionWindowLow", () => {
  it("returns true when no future occurrences within window", () => {
    expect(
      isExpansionWindowLow(["2026-05-01", "2026-05-04"], "2026-05-06", 14),
    ).toBe(true);
  });

  it("returns false when at least one occurrence at or beyond window", () => {
    expect(
      isExpansionWindowLow(["2026-05-25"], "2026-05-06", 14),
    ).toBe(false);
  });

  it("returns true on empty list", () => {
    expect(isExpansionWindowLow([], "2026-05-06", 14)).toBe(true);
  });
});
