import { formatInTimeZone, toZonedTime, fromZonedTime } from "date-fns-tz";
import { format, parseISO } from "date-fns";

export const HOUSEHOLD_TZ = "Asia/Tokyo";

export function jstNow(): Date {
  return toZonedTime(new Date(), HOUSEHOLD_TZ);
}

export function jstDateString(date: Date = new Date()): string {
  return formatInTimeZone(date, HOUSEHOLD_TZ, "yyyy-MM-dd");
}

export function dateStringFromIso(iso: string): string {
  return formatInTimeZone(parseISO(iso), HOUSEHOLD_TZ, "yyyy-MM-dd");
}

// scheduled_for is stored as a `date` in Postgres. We treat it as a JST
// calendar day. Convert to a UTC instant at JST midnight when we need a
// comparable timestamp.
export function jstMidnightUtc(dateString: string): Date {
  return fromZonedTime(`${dateString}T00:00:00`, HOUSEHOLD_TZ);
}

export function formatJstTime(date: Date): string {
  return formatInTimeZone(date, HOUSEHOLD_TZ, "HH:mm");
}

export function formatJstDateTime(date: Date): string {
  return formatInTimeZone(date, HOUSEHOLD_TZ, "yyyy-MM-dd HH:mm");
}

export function formatHumanDate(dateString: string): string {
  return format(parseISO(dateString), "EEE, MMM d");
}
