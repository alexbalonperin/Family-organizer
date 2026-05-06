"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { getCurrentUserOrRedirect, assertParent } from "@/lib/auth";
import { messages } from "@/lib/messages";

const createSchema = z.object({
  template_id: z.string().uuid(),
  assigned_user_id: z.string().uuid(),
  scheduled_for: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function createOneOffTask(formData: FormData) {
  const me = await getCurrentUserOrRedirect();
  try {
    assertParent(me);
  } catch {
    return { error: messages.errors.notAllowed };
  }

  const parsed = createSchema.safeParse({
    template_id: formData.get("template_id"),
    assigned_user_id: formData.get("assigned_user_id"),
    scheduled_for: formData.get("scheduled_for"),
  });
  if (!parsed.success) return { error: messages.errors.generic };

  // Validate template + assignee are in this household.
  const [tpl] = await db
    .select({ id: schema.taskTemplates.id })
    .from(schema.taskTemplates)
    .where(
      and(
        eq(schema.taskTemplates.id, parsed.data.template_id),
        eq(schema.taskTemplates.householdId, me.householdId),
      ),
    )
    .limit(1);
  if (!tpl) return { error: messages.errors.notFound };

  const [assignee] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(
      and(
        eq(schema.users.id, parsed.data.assigned_user_id),
        eq(schema.users.householdId, me.householdId),
      ),
    )
    .limit(1);
  if (!assignee) return { error: messages.errors.notFound };

  await db.insert(schema.taskInstances).values({
    householdId: me.householdId,
    templateId: parsed.data.template_id,
    scheduleId: null,
    scheduledFor: parsed.data.scheduled_for,
    assignedUserId: parsed.data.assigned_user_id,
    status: "pending",
  });

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  return { ok: true };
}
