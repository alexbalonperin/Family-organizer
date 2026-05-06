// Edge Function (Deno). Sends web push to all subscriptions for a user and,
// on success, inserts reminder_log rows so the SQL-side cron can be retried
// safely without double-sending.
//
// Auth: this function is called from pg_net inside send_due_reminders() with
// the service role key as Bearer. verify_jwt is set to false in
// supabase/config.toml — the function checks the Authorization header itself
// against SUPABASE_SERVICE_ROLE_KEY for defense in depth.
//
// Body shape:
//   { user_id: uuid, instance_ids: uuid[], kind: 'morning'|'evening', slot_date: yyyy-MM-dd }
//   or for the test path:
//   { user_id: uuid, test: true, title?, body?, url? }

// @ts-nocheck — Deno runtime; types resolved by `supabase functions serve`.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

interface ReminderBody {
  user_id: string;
  instance_ids?: string[];
  kind?: "morning" | "evening";
  slot_date?: string;
  test?: boolean;
  title?: string;
  body?: string;
  url?: string;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  const auth = req.headers.get("Authorization") ?? "";
  if (auth !== `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: ReminderBody;
  try {
    payload = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }
  if (!payload.user_id) {
    return new Response("Missing user_id", { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Load all subscriptions for this user.
  const { data: subs, error: subsErr } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", payload.user_id);

  if (subsErr) return new Response(subsErr.message, { status: 500 });
  if (!subs || subs.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
  }

  // Build the notification payload.
  let title = payload.title ?? "SoujiShiyo";
  let body = payload.body ?? "";
  let url = payload.url ?? "/";

  if (!payload.test && payload.instance_ids && payload.instance_ids.length > 0) {
    // Look up the first instance for a concise title; if multiple, summarize.
    const { data: instances } = await supabase
      .from("task_instances")
      .select(
        "id, template_id, task_templates!inner(name, areas!inner(name))",
      )
      .in("id", payload.instance_ids);

    if (instances && instances.length > 0) {
      const first = instances[0] as any;
      const areaName = first.task_templates?.areas?.name ?? "";
      const templateName = first.task_templates?.name ?? "Task";
      const more = instances.length > 1 ? ` +${instances.length - 1} more` : "";
      title = `🧹 ${templateName}`;
      body = `${areaName}${more}`;
      url = `/tasks/${first.id}`;
    }
  }

  const pushPayload = JSON.stringify({
    title,
    body,
    url,
    tag: payload.kind ? `chores-${payload.kind}` : undefined,
  });

  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification(
        {
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh, auth: s.auth },
        },
        pushPayload,
      ),
    ),
  );

  let sent = 0;
  let failed = 0;
  const goneIds: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const sub = subs[i];
    if (r.status === "fulfilled") {
      sent++;
    } else {
      failed++;
      const code = (r.reason as { statusCode?: number })?.statusCode;
      if (code === 404 || code === 410) goneIds.push(sub.id);
    }
  }

  if (goneIds.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", goneIds);
  }

  // Idempotency log: only for non-test reminder pushes.
  if (
    sent > 0 &&
    !payload.test &&
    payload.instance_ids &&
    payload.instance_ids.length > 0 &&
    payload.kind &&
    payload.slot_date
  ) {
    const rows = payload.instance_ids.map((id) => ({
      instance_id: id,
      user_id: payload.user_id,
      kind: payload.kind,
      slot_date: payload.slot_date,
    }));
    // unique constraint on (instance_id, user_id, kind, slot_date) absorbs duplicates
    await supabase
      .from("reminder_log")
      .upsert(rows, {
        onConflict: "instance_id,user_id,kind,slot_date",
        ignoreDuplicates: true,
      });
  }

  return new Response(
    JSON.stringify({ sent, failed, gone: goneIds.length }),
    { headers: { "Content-Type": "application/json" } },
  );
});
