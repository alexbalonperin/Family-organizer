"use server";

import { revalidatePath } from "next/cache";
import { eq, and, max } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { getCurrentUserOrRedirect, assertParent } from "@/lib/auth";
import { messages } from "@/lib/messages";

const schemaCreate = z.object({
  name: z.string().min(1).max(60),
  icon: z.string().min(1).max(4),
  cadence: z.coerce.number().int().min(1).max(365),
});

const schemaUpdate = schemaCreate.extend({
  id: z.string().uuid(),
});

export async function createArea(formData: FormData) {
  const me = await getCurrentUserOrRedirect();
  try {
    assertParent(me);
  } catch {
    return { error: messages.errors.notAllowed };
  }

  const parsed = schemaCreate.safeParse({
    name: formData.get("name"),
    icon: formData.get("icon"),
    cadence: formData.get("cadence"),
  });
  if (!parsed.success) return { error: messages.errors.generic };

  const [{ value: maxSort }] = await db
    .select({ value: max(schema.areas.sortOrder) })
    .from(schema.areas)
    .where(eq(schema.areas.householdId, me.householdId));

  const [row] = await db
    .insert(schema.areas)
    .values({
      householdId: me.householdId,
      name: parsed.data.name,
      icon: parsed.data.icon,
      expectedCadenceDays: parsed.data.cadence,
      sortOrder: (maxSort ?? 0) + 1,
    })
    .returning({ id: schema.areas.id });

  await db.insert(schema.areaState).values({ areaId: row.id });

  revalidatePath("/areas");
  revalidatePath("/dashboard");
  return { ok: true, id: row.id };
}

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
