// Edge Function (Deno). Called by generate_upcoming_instances() via pg_net
// when a schedule's next_occurrences window has fewer than 14 days of dates
// remaining ahead of today. Re-expands the rrule for the next 30 days and
// writes the result back to task_schedules.next_occurrences.
//
// Body: { schedule_id: string }
// Auth: verify_jwt = false in config.toml — pg_net calls this internally
//       with the service-role bearer token; no end-user auth context.

// @ts-nocheck — Deno runtime; types resolved by `supabase functions serve`.
import { createClient } from "npm:@supabase/supabase-js@2";
// @ts-nocheck
import { RRule } from "npm:rrule@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TZ = "Asia/Tokyo";

function jstDateString(d: Date): string {
  // Format yyyy-MM-dd for the JST calendar day.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function expand(rruleString: string, days: number): string[] {
  const rule = RRule.fromString(rruleString);
  const from = new Date();
  const to = new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
  const occurrences = rule.between(from, to, true);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const o of occurrences) {
    const day = jstDateString(o);
    if (!seen.has(day)) {
      seen.add(day);
      out.push(day);
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let payload: { schedule_id?: string };
  try {
    payload = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  if (!payload.schedule_id) {
    return new Response("Missing schedule_id", { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: schedule, error: loadErr } = await supabase
    .from("task_schedules")
    .select("id, rrule_string, active")
    .eq("id", payload.schedule_id)
    .single();

  if (loadErr || !schedule) {
    return new Response("Schedule not found", { status: 404 });
  }
  if (!schedule.active || !schedule.rrule_string) {
    return new Response(JSON.stringify({ skipped: true }), { status: 200 });
  }

  let next: string[];
  try {
    next = expand(schedule.rrule_string, 30);
  } catch (e) {
    return new Response(`Bad rrule: ${e instanceof Error ? e.message : e}`, {
      status: 400,
    });
  }

  const { error: updErr } = await supabase
    .from("task_schedules")
    .update({ next_occurrences: next })
    .eq("id", schedule.id);

  if (updErr) {
    return new Response(`Update failed: ${updErr.message}`, { status: 500 });
  }

  return new Response(
    JSON.stringify({ schedule_id: schedule.id, next_count: next.length }),
    { headers: { "Content-Type": "application/json" } },
  );
});
