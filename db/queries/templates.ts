import "server-only";
import { eq, asc, and } from "drizzle-orm";
import { db, schema } from "@/db/client";

export async function listTemplatesWithArea(householdId: string) {
  return db
    .select({
      id: schema.taskTemplates.id,
      name: schema.taskTemplates.name,
      description: schema.taskTemplates.description,
      expectedDurationMinutes: schema.taskTemplates.expectedDurationMinutes,
      areaId: schema.taskTemplates.areaId,
      areaName: schema.areas.name,
      areaIcon: schema.areas.icon,
      areaSortOrder: schema.areas.sortOrder,
    })
    .from(schema.taskTemplates)
    .innerJoin(schema.areas, eq(schema.areas.id, schema.taskTemplates.areaId))
    .where(eq(schema.taskTemplates.householdId, householdId))
    .orderBy(asc(schema.areas.sortOrder), asc(schema.taskTemplates.name));
}

export async function getTemplate(householdId: string, templateId: string) {
  const [tpl] = await db
    .select()
    .from(schema.taskTemplates)
    .where(
      and(
        eq(schema.taskTemplates.id, templateId),
        eq(schema.taskTemplates.householdId, householdId),
      ),
    )
    .limit(1);
  if (!tpl) return null;

  const items = await db
    .select()
    .from(schema.checklistItems)
    .where(eq(schema.checklistItems.templateId, templateId))
    .orderBy(asc(schema.checklistItems.sortOrder));

  return { ...tpl, items };
}
