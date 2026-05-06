"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { getCurrentUserOrRedirect, assertParent } from "@/lib/auth";
import { messages } from "@/lib/messages";

const createSchema = z.object({
  name: z.string().min(1).max(80),
  area_id: z.string().uuid(),
  duration: z.coerce.number().int().min(1).max(480),
  description: z.string().max(2000).optional(),
});

const updateSchema = createSchema.extend({
  id: z.string().uuid(),
});

export async function createTemplate(formData: FormData) {
  const me = await getCurrentUserOrRedirect();
  try {
    assertParent(me);
  } catch {
    return { error: messages.errors.notAllowed };
  }

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    area_id: formData.get("area_id"),
    duration: formData.get("duration"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) return { error: messages.errors.generic };

  // Defensive: area must be in same household.
  const [area] = await db
    .select({ id: schema.areas.id })
    .from(schema.areas)
    .where(
      and(
        eq(schema.areas.id, parsed.data.area_id),
        eq(schema.areas.householdId, me.householdId),
      ),
    )
    .limit(1);
  if (!area) return { error: messages.errors.notFound };

  const [row] = await db
    .insert(schema.taskTemplates)
    .values({
      householdId: me.householdId,
      areaId: parsed.data.area_id,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      expectedDurationMinutes: parsed.data.duration,
      createdByUserId: me.id,
    })
    .returning({ id: schema.taskTemplates.id });

  revalidatePath("/templates");
  return { id: row.id };
}

export async function updateTemplate(formData: FormData) {
  const me = await getCurrentUserOrRedirect();
  try {
    assertParent(me);
  } catch {
    return { error: messages.errors.notAllowed };
  }

  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    area_id: formData.get("area_id"),
    duration: formData.get("duration"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) return { error: messages.errors.generic };

  await db
    .update(schema.taskTemplates)
    .set({
      name: parsed.data.name,
      areaId: parsed.data.area_id,
      expectedDurationMinutes: parsed.data.duration,
      description: parsed.data.description ?? null,
    })
    .where(
      and(
        eq(schema.taskTemplates.id, parsed.data.id),
        eq(schema.taskTemplates.householdId, me.householdId),
      ),
    );

  revalidatePath(`/templates/${parsed.data.id}`);
  revalidatePath("/templates");
  return { ok: true };
}

export async function deleteTemplate(templateId: string) {
  const me = await getCurrentUserOrRedirect();
  try {
    assertParent(me);
  } catch {
    return { error: messages.errors.notAllowed };
  }

  await db
    .delete(schema.taskTemplates)
    .where(
      and(
        eq(schema.taskTemplates.id, templateId),
        eq(schema.taskTemplates.householdId, me.householdId),
      ),
    );

  revalidatePath("/templates");
  return { ok: true };
}

export async function saveChecklist(
  templateId: string,
  items: { label: string; sortOrder: number }[],
) {
  const me = await getCurrentUserOrRedirect();
  try {
    assertParent(me);
  } catch {
    return { error: messages.errors.notAllowed };
  }

  // Verify template ownership.
  const [tpl] = await db
    .select({ id: schema.taskTemplates.id })
    .from(schema.taskTemplates)
    .where(
      and(
        eq(schema.taskTemplates.id, templateId),
        eq(schema.taskTemplates.householdId, me.householdId),
      ),
    )
    .limit(1);
  if (!tpl) return { error: messages.errors.notFound };

  // Replace-all strategy: simpler than diffing for v1, and templates are
  // small (4-6 items typical). Cascading delete on checklist_completions is
  // intentional — past task instances retain only the items present at
  // completion time.
  await db
    .delete(schema.checklistItems)
    .where(eq(schema.checklistItems.templateId, templateId));

  if (items.length > 0) {
    await db.insert(schema.checklistItems).values(
      items.map((i) => ({
        templateId,
        label: i.label,
        sortOrder: i.sortOrder,
      })),
    );
  }

  revalidatePath(`/templates/${templateId}`);
  return { ok: true };
}
