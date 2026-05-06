import "server-only";
import { eq, and, desc } from "drizzle-orm";
import { db, schema } from "@/db/client";

export async function listSchedulesForTemplate(
  householdId: string,
  templateId: string,
) {
  return db
    .select()
    .from(schema.taskSchedules)
    .where(
      and(
        eq(schema.taskSchedules.templateId, templateId),
        eq(schema.taskSchedules.householdId, householdId),
      ),
    )
    .orderBy(desc(schema.taskSchedules.createdAt));
}

export async function getSchedule(householdId: string, scheduleId: string) {
  const [row] = await db
    .select()
    .from(schema.taskSchedules)
    .where(
      and(
        eq(schema.taskSchedules.id, scheduleId),
        eq(schema.taskSchedules.householdId, householdId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function listInstancesForSchedule(
  householdId: string,
  scheduleId: string,
) {
  return db
    .select({
      id: schema.taskInstances.id,
      scheduledFor: schema.taskInstances.scheduledFor,
      status: schema.taskInstances.status,
    })
    .from(schema.taskInstances)
    .where(
      and(
        eq(schema.taskInstances.scheduleId, scheduleId),
        eq(schema.taskInstances.householdId, householdId),
      ),
    );
}
