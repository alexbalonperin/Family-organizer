"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { getCurrentUserOrRedirect, assertParent } from "@/lib/auth";
import { messages } from "@/lib/messages";

const schemaUpdate = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(60),
  icon: z.string().min(1).max(4),
  cadence: z.coerce.number().int().min(1).max(365),
});

export async function updateArea(formData: FormData) {
  const me = await getCurrentUserOrRedirect();
  try {
    assertParent(me);
  } catch {
    return { error: messages.errors.notAllowed };
  }

  const parsed = schemaUpdate.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    icon: formData.get("icon"),
    cadence: formData.get("cadence"),
  });
  if (!parsed.success) return { error: messages.errors.generic };

  await db
    .update(schema.areas)
    .set({
      name: parsed.data.name,
      icon: parsed.data.icon,
      expectedCadenceDays: parsed.data.cadence,
    })
    .where(
      and(
        eq(schema.areas.id, parsed.data.id),
        eq(schema.areas.householdId, me.householdId),
      ),
    );

  revalidatePath("/areas");
  revalidatePath("/dashboard");
  return { ok: true };
}
