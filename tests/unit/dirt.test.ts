import { describe, expect, it } from "vitest";
import { computeDirtLevel } from "@/lib/dirt";

describe("computeDirtLevel", () => {
  const cadence = 2; // days
  const now = new Date("2026-05-06T12:00:00Z");

  const daysAgo = (days: number) =>
    new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  it("returns 4 when never cleaned", () => {
    expect(computeDirtLevel(cadence, null, now)).toBe(4);
  });

  it("returns 0 when cleaned recently (ratio < 0.5)", () => {
    expect(computeDirtLevel(cadence, daysAgo(0.5), now)).toBe(0);
  });

  it("returns 1 around half-cadence (0.5 <= ratio < 1.0)", () => {
    expect(computeDirtLevel(cadence, daysAgo(1.5), now)).toBe(1);
  });

  it("returns 2 around cadence (1.0 <= ratio < 1.5)", () => {
    expect(computeDirtLevel(cadence, daysAgo(2.5), now)).toBe(2);
  });

  it("returns 3 between 1.5x and 2.5x cadence", () => {
    expect(computeDirtLevel(cadence, daysAgo(4), now)).toBe(3);
  });

  it("returns 4 well past cadence", () => {
    expect(computeDirtLevel(cadence, daysAgo(20), now)).toBe(4);
  });
});
