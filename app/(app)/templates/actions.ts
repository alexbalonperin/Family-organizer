"use server";

import { revalidatePath } from "next/cache";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { getCurrentUserOrRedirect, assertParent } from "@/lib/auth";
import { messages } from "@/lib/messages";
import { expandSchedule } from "@/lib/rrule/expand";
import { reconcileSchedule } from "@/lib/rrule/reconcile";
import { jstDateString } from "@/lib/tz";

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

// ---------------------------------------------------------------------------
// Schedules
// ---------------------------------------------------------------------------

const saveScheduleSchema = z.object({
  templateId: z.string().uuid(),
  scheduleId: z.string().uuid().nullable(),
  rruleString: z.string().min(5).max(1000),
  assignmentPolicy: z.enum(["fixed", "round_robin", "load_balanced"]),
  assigneeUserIds: z.array(z.string().uuid()).min(1),
  active: z.boolean(),
});

const EXPAND_DAYS = 30;

export async function saveSchedule(input: {
  templateId: string;
  scheduleId: string | null;
  rruleString: string;
  assignmentPolicy: "fixed" | "round_robin" | "load_balanced";
  assigneeUserIds: string[];
  active: boolean;
}) {
  const me = await getCurrentUserOrRedirect();
  try {
    assertParent(me);
  } catch {
    return { error: messages.errors.notAllowed };
  }

  const parsed = saveScheduleSchema.safeParse(input);
  if (!parsed.success) return { error: messages.errors.generic };

  // Verify template ownership.
  const [tpl] = await db
    .select({ id: schema.taskTemplates.id })
    .from(schema.taskTemplates)
    .where(
      and(
        eq(schema.taskTemplates.id, parsed.data.templateId),
        eq(schema.taskTemplates.householdId, me.householdId),
      ),
    )
    .limit(1);
  if (!tpl) return { error: messages.errors.notFound };

  // Verify all assignees belong to the household.
  const assigneeRows = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(
      and(
        eq(schema.users.householdId, me.householdId),
        inArray(schema.users.id, parsed.data.assigneeUserIds),
      ),
    );
  if (assigneeRows.length !== parsed.data.assigneeUserIds.length) {
    return { error: messages.errors.notFound };
  }

  // Expand rrule for the next 30 days.
  let nextOccurrences: string[];
  try {
    nextOccurrences = expandSchedule(
      parsed.data.rruleString,
      new Date(),
      EXPAND_DAYS,
    );
  } catch {
    return { error: "Invalid recurrence rule." };
  }

  const today = jstDateString();

  await db.transaction(async (tx) => {
    let scheduleId = parsed.data.scheduleId;

    if (scheduleId) {
      // Edit path: load existing instances, run reconcile, delete dropped pendings.
      const existing = await tx
        .select({
          id: schema.taskInstances.id,
          scheduledFor: schema.taskInstances.scheduledFor,
          status: schema.taskInstances.status,
        })
        .from(schema.taskInstances)
        .where(eq(schema.taskInstances.scheduleId, scheduleId));

      const result = reconcileSchedule({
        existing: existing.map((e) => ({
          id: e.id,
          scheduledFor: e.scheduledFor,
          status: e.status,
        })),
        newOccurrences: nextOccurrences,
        today,
      });

      if (result.toDeleteIds.length > 0) {
        await tx
          .delete(schema.taskInstances)
          .where(inArray(schema.taskInstances.id, result.toDeleteIds));
      }

      await tx
        .update(schema.taskSchedules)
        .set({
          rruleString: parsed.data.rruleString,
          assignmentPolicy: parsed.data.assignmentPolicy,
          assigneeUserIds: parsed.data.assigneeUserIds,
          nextOccurrences,
          active: parsed.data.active,
        })
        .where(
          and(
            eq(schema.taskSchedules.id, scheduleId),
            eq(schema.taskSchedules.householdId, me.householdId),
          ),
        );
    } else {
      // Create path.
      const [row] = await tx
        .insert(schema.taskSchedules)
        .values({
          householdId: me.householdId,
          templateId: parsed.data.templateId,
          rruleString: parsed.data.rruleString,
          assignmentPolicy: parsed.data.assignmentPolicy,
          assigneeUserIds: parsed.data.assigneeUserIds,
          nextOccurrences,
          active: parsed.data.active,
        })
        .returning({ id: schema.taskSchedules.id });
      scheduleId = row.id;
    }
  });

  revalidatePath(`/templates/${parsed.data.templateId}`);
  revalidatePath("/tasks");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteSchedule(scheduleId: string) {
  const me = await getCurrentUserOrRedirect();
  try {
    assertParent(me);
  } catch {
    return { error: messages.errors.notAllowed };
  }

  const today = jstDateString();

  await db.transaction(async (tx) => {
    // Delete only pending future instances; preserve history.
    await tx
      .delete(schema.taskInstances)
      .where(
        and(
          eq(schema.taskInstances.scheduleId, scheduleId),
          eq(schema.taskInstances.householdId, me.householdId),
          eq(schema.taskInstances.status, "pending"),
        ),
      );

    await tx
      .delete(schema.taskSchedules)
      .where(
        and(
          eq(schema.taskSchedules.id, scheduleId),
          eq(schema.taskSchedules.householdId, me.householdId),
        ),
      );

    // Suppress unused-warning while keeping `today` available if we extend.
    void today;
  });

  revalidatePath("/tasks");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function toggleScheduleActive(
  scheduleId: string,
  active: boolean,
) {
  const me = await getCurrentUserOrRedirect();
  try {
    assertParent(me);
  } catch {
    return { error: messages.errors.notAllowed };
  }

  await db
    .update(schema.taskSchedules)
    .set({ active })
    .where(
      and(
        eq(schema.taskSchedules.id, scheduleId),
        eq(schema.taskSchedules.householdId, me.householdId),
      ),
    );

  revalidatePath("/templates");
  return { ok: true };
}
