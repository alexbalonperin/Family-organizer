"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { getCurrentUserOrRedirect } from "@/lib/auth";
import { messages } from "@/lib/messages";

async function ensureMutationAllowed(taskId: string) {
  const me = await getCurrentUserOrRedirect();
  const [task] = await db
    .select()
    .from(schema.taskInstances)
    .where(
      and(
        eq(schema.taskInstances.id, taskId),
        eq(schema.taskInstances.householdId, me.householdId),
      ),
    )
    .limit(1);
  if (!task) return { error: messages.errors.notFound, me: null, task: null };
  const allowed = me.role === "parent" || task.assignedUserId === me.id;
  if (!allowed) return { error: messages.errors.notAllowed, me: null, task: null };
  return { error: null, me, task };
}

export async function startTask(taskId: string) {
  const guard = await ensureMutationAllowed(taskId);
  if (guard.error) return { error: guard.error };
  if (guard.task!.status !== "pending") return { error: "Already started." };

  await db
    .update(schema.taskInstances)
    .set({ status: "in_progress", startedAt: new Date() })
    .where(eq(schema.taskInstances.id, taskId));

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  return { ok: true };
}

const toggleSchema = z.object({
  itemId: z.string().uuid(),
  done: z.boolean(),
});

export async function toggleChecklistItem(
  taskId: string,
  itemId: string,
  done: boolean,
) {
  const guard = await ensureMutationAllowed(taskId);
  if (guard.error) return { error: guard.error };

  const parsed = toggleSchema.safeParse({ itemId, done });
  if (!parsed.success) return { error: messages.errors.generic };

  if (done) {
    // Insert or do nothing on conflict — composite uniqueness on (instance, item).
    await db
      .insert(schema.checklistCompletions)
      .values({
        instanceId: taskId,
        checklistItemId: itemId,
        checkedByUserId: guard.me!.id,
      })
      .onConflictDoNothing();
  } else {
    await db
      .delete(schema.checklistCompletions)
      .where(
        and(
          eq(schema.checklistCompletions.instanceId, taskId),
          eq(schema.checklistCompletions.checklistItemId, itemId),
        ),
      );
  }

  revalidatePath(`/tasks/${taskId}`);
  return { ok: true };
}

const completeSchema = z.object({
  completedBy: z.string().uuid(),
  notes: z.string().max(2000).optional(),
});

export async function completeTask(
  taskId: string,
  completedByUserId: string,
  notes: string,
) {
  const guard = await ensureMutationAllowed(taskId);
  if (guard.error) return { error: guard.error };
  if (guard.task!.status === "completed")
    return { error: "Already completed." };

  const parsed = completeSchema.safeParse({
    completedBy: completedByUserId,
    notes: notes || undefined,
  });
  if (!parsed.success) return { error: messages.errors.generic };

  // Verify completedBy is in the household.
  const [member] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(
      and(
        eq(schema.users.id, parsed.data.completedBy),
        eq(schema.users.householdId, guard.me!.householdId),
      ),
    )
    .limit(1);
  if (!member) return { error: messages.errors.notFound };

  // Update instance, set area_state.last_cleaned_at, then refresh dirt level.
  // Wrapped in a single transaction for atomicity.
  await db.transaction(async (tx) => {
    await tx
      .update(schema.taskInstances)
      .set({
        status: "completed",
        completedAt: new Date(),
        completedByUserId: parsed.data.completedBy,
        notes: parsed.data.notes ?? null,
      })
      .where(eq(schema.taskInstances.id, taskId));

    // Look up the area for this instance.
    const [areaRow] = await tx
      .select({ areaId: schema.taskTemplates.areaId })
      .from(schema.taskInstances)
      .innerJoin(
        schema.taskTemplates,
        eq(schema.taskTemplates.id, schema.taskInstances.templateId),
      )
      .where(eq(schema.taskInstances.id, taskId));

    if (areaRow) {
      await tx
        .insert(schema.areaState)
        .values({
          areaId: areaRow.areaId,
          lastCleanedAt: new Date(),
          dirtLevel: 0,
        })
        .onConflictDoUpdate({
          target: schema.areaState.areaId,
          set: { lastCleanedAt: new Date(), dirtLevel: 0 },
        });
    }

    // Recompute dirt for the household.
    await tx.execute(
      sql`select refresh_dirt_levels(${guard.me!.householdId})`,
    );
  });

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/areas");
  return { ok: true };
}

export async function skipTask(taskId: string) {
  const guard = await ensureMutationAllowed(taskId);
  if (guard.error) return { error: guard.error };

  await db
    .update(schema.taskInstances)
    .set({ status: "skipped", completedAt: new Date() })
    .where(eq(schema.taskInstances.id, taskId));

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function setNotes(taskId: string, notes: string) {
  const guard = await ensureMutationAllowed(taskId);
  if (guard.error) return { error: guard.error };

  await db
    .update(schema.taskInstances)
    .set({ notes: notes || null })
    .where(eq(schema.taskInstances.id, taskId));

  revalidatePath(`/tasks/${taskId}`);
  return { ok: true };
}
