import { RRule } from "rrule";
import { formatInTimeZone } from "date-fns-tz";
import { HOUSEHOLD_TZ } from "@/lib/tz";

// Expand an rrule string to a list of yyyy-MM-dd date strings interpreted in
// the household timezone (JST). The rrule lib operates in UTC under the hood;
// we interpret the date portion of each occurrence in JST so a `RRULE:...;BYHOUR=0`
// string is unnecessary — we just take the JST calendar day.
//
// `from` is inclusive, `days` is the number of days to look ahead.
export function expandSchedule(
  rruleString: string,
  from: Date,
  days: number,
): string[] {
  const rule = RRule.fromString(rruleString);
  const fromUtc = new Date(from);
  const until = new Date(fromUtc.getTime() + days * 24 * 60 * 60 * 1000);
  // `between` is exclusive of the upper bound by default; we want it inclusive
  // of `from` and ranged across `days`.
  const occurrences = rule.between(fromUtc, until, true);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const occ of occurrences) {
    const day = formatInTimeZone(occ, HOUSEHOLD_TZ, "yyyy-MM-dd");
    if (!seen.has(day)) {
      seen.add(day);
      result.push(day);
    }
  }
  return result;
}

// Build a simple weekly rrule from a UI form. days is 0=Mon..6=Sun (rrule
// convention) — we keep that mapping in the UI to avoid surprises.
export function buildWeeklyRrule(opts: {
  byDay: ReadonlyArray<"MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU">;
  startDate: Date;
}): string {
  const days = opts.byDay.join(",");
  const dtstart = formatInTimeZone(
    opts.startDate,
    HOUSEHOLD_TZ,
    "yyyyMMdd'T'050000",
  );
  // 05:00 JST anchor — well before the daily generator runs at 05:00 JST,
  // so `between(today, today+14)` will include today if it matches BYDAY.
  return `DTSTART:${dtstart}\nRRULE:FREQ=WEEKLY;BYDAY=${days}`;
}

export function buildDailyRrule(startDate: Date): string {
  const dtstart = formatInTimeZone(
    startDate,
    HOUSEHOLD_TZ,
    "yyyyMMdd'T'050000",
  );
  return `DTSTART:${dtstart}\nRRULE:FREQ=DAILY`;
}

// Window-low check: returns true if the schedule's pre-expanded next_occurrences
// run dry within `windowDays` days of today. Used by the cron generator to
// decide whether to call back into Edge Function `expand-schedule`.
export function isExpansionWindowLow(
  nextOccurrences: string[],
  today: string,
  windowDays = 14,
): boolean {
  const todayMs = new Date(`${today}T00:00:00Z`).getTime();
  const cutoffMs = todayMs + windowDays * 24 * 60 * 60 * 1000;
  for (const day of nextOccurrences) {
    const ms = new Date(`${day}T00:00:00Z`).getTime();
    if (ms >= cutoffMs) return false;
  }
  return true;
}
