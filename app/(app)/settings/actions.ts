"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { getCurrentUserOrRedirect } from "@/lib/auth";
import { messages } from "@/lib/messages";

const subSchema = z.object({
  endpoint: z.string().url().max(2000),
  p256dh: z.string().min(1).max(500),
  auth: z.string().min(1).max(500),
});

export async function savePushSubscription(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
}) {
  const me = await getCurrentUserOrRedirect();
  const parsed = subSchema.safeParse(input);
  if (!parsed.success) return { error: messages.errors.generic };

  await db
    .insert(schema.pushSubscriptions)
    .values({
      userId: me.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.p256dh,
      auth: parsed.data.auth,
    })
    .onConflictDoUpdate({
      target: schema.pushSubscriptions.endpoint,
      set: {
        userId: me.id,
        p256dh: parsed.data.p256dh,
        auth: parsed.data.auth,
      },
    });

  revalidatePath("/settings");
  return { ok: true };
}

export async function deletePushSubscription(endpoint: string) {
  const me = await getCurrentUserOrRedirect();
  await db
    .delete(schema.pushSubscriptions)
    .where(
      and(
        eq(schema.pushSubscriptions.endpoint, endpoint),
        eq(schema.pushSubscriptions.userId, me.id),
      ),
    );
  revalidatePath("/settings");
  return { ok: true };
}

const remindersSchema = z.object({
  morning: z.string().regex(/^\d{2}:\d{2}$/),
  evening: z.string().regex(/^\d{2}:\d{2}$/),
  enabled: z.boolean(),
});

export async function saveReminderSettings(input: {
  morning: string;
  evening: string;
  enabled: boolean;
}) {
  const me = await getCurrentUserOrRedirect();
  const parsed = remindersSchema.safeParse(input);
  if (!parsed.success) return { error: messages.errors.generic };

  await db
    .insert(schema.userSettings)
    .values({
      userId: me.id,
      morningReminderTime: parsed.data.morning,
      eveningReminderTime: parsed.data.evening,
      remindersEnabled: parsed.data.enabled,
    })
    .onConflictDoUpdate({
      target: schema.userSettings.userId,
      set: {
        morningReminderTime: parsed.data.morning,
        eveningReminderTime: parsed.data.evening,
        remindersEnabled: parsed.data.enabled,
      },
    });

  revalidatePath("/settings");
  return { ok: true };
}

// Test push: invokes the send-push Edge Function for the current user with a
// synthetic payload (no instance_ids, just a "test" body). The function
// short-circuits the reminder_log insert when test=true.
export async function sendTestPush() {
  const me = await getCurrentUserOrRedirect();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { error: "Server is missing Supabase credentials." };

  const res = await fetch(`${url}/functions/v1/send-push`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: me.id,
      test: true,
      title: "SoujiShiyo",
      body: "🧹 This is a test push.",
      url: "/dashboard",
    }),
  });
  if (!res.ok) {
    return { error: `Test push failed (${res.status})` };
  }
  return { ok: true };
}
