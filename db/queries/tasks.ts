import "server-only";
import { eq, and, asc, desc, gte, lt, inArray } from "drizzle-orm";
import { db, schema } from "@/db/client";

export interface TaskListItem {
  id: string;
  scheduledFor: string;
  status: "pending" | "in_progress" | "completed" | "skipped";
  startedAt: Date | null;
  completedAt: Date | null;
  notes: string | null;
  templateId: string;
  templateName: string;
  durationMin: number;
  areaId: string;
  areaName: string;
  areaIcon: string;
  assignedUserId: string;
  assigneeName: string;
  assigneeColor: string;
}

export async function listTasks(opts: {
  householdId: string;
  fromDate?: string;
  toDate?: string;
  assigneeId?: string;
  areaId?: string;
  status?: "pending" | "in_progress" | "completed" | "skipped";
}) {
  const conds = [eq(schema.taskInstances.householdId, opts.householdId)];
  if (opts.fromDate)
    conds.push(gte(schema.taskInstances.scheduledFor, opts.fromDate));
  if (opts.toDate) conds.push(lt(schema.taskInstances.scheduledFor, opts.toDate));
  if (opts.assigneeId)
    conds.push(eq(schema.taskInstances.assignedUserId, opts.assigneeId));
  if (opts.areaId) conds.push(eq(schema.areas.id, opts.areaId));
  if (opts.status) conds.push(eq(schema.taskInstances.status, opts.status));

  const rows = await db
    .select({
      id: schema.taskInstances.id,
      scheduledFor: schema.taskInstances.scheduledFor,
      status: schema.taskInstances.status,
      startedAt: schema.taskInstances.startedAt,
      completedAt: schema.taskInstances.completedAt,
      notes: schema.taskInstances.notes,
      templateId: schema.taskTemplates.id,
      templateName: schema.taskTemplates.name,
      durationMin: schema.taskTemplates.expectedDurationMinutes,
      areaId: schema.areas.id,
      areaName: schema.areas.name,
      areaIcon: schema.areas.icon,
      assignedUserId: schema.taskInstances.assignedUserId,
      assigneeName: schema.users.displayName,
      assigneeColor: schema.users.avatarColor,
    })
    .from(schema.taskInstances)
    .innerJoin(
      schema.taskTemplates,
      eq(schema.taskTemplates.id, schema.taskInstances.templateId),
    )
    .innerJoin(schema.areas, eq(schema.areas.id, schema.taskTemplates.areaId))
    .innerJoin(
      schema.users,
      eq(schema.users.id, schema.taskInstances.assignedUserId),
    )
    .where(and(...conds))
    .orderBy(
      asc(schema.taskInstances.scheduledFor),
      asc(schema.taskTemplates.name),
    );
  return rows as TaskListItem[];
}

export async function getTaskInstance(householdId: string, id: string) {
  const [row] = await db
    .select({
      id: schema.taskInstances.id,
      scheduledFor: schema.taskInstances.scheduledFor,
      status: schema.taskInstances.status,
      startedAt: schema.taskInstances.startedAt,
      completedAt: schema.taskInstances.completedAt,
      completedByUserId: schema.taskInstances.completedByUserId,
      notes: schema.taskInstances.notes,
      templateId: schema.taskTemplates.id,
      templateName: schema.taskTemplates.name,
      templateDescription: schema.taskTemplates.description,
      durationMin: schema.taskTemplates.expectedDurationMinutes,
      areaId: schema.areas.id,
      areaName: schema.areas.name,
      areaIcon: schema.areas.icon,
      assignedUserId: schema.taskInstances.assignedUserId,
      assigneeName: schema.users.displayName,
      assigneeColor: schema.users.avatarColor,
    })
    .from(schema.taskInstances)
    .innerJoin(
      schema.taskTemplates,
      eq(schema.taskTemplates.id, schema.taskInstances.templateId),
    )
    .innerJoin(schema.areas, eq(schema.areas.id, schema.taskTemplates.areaId))
    .innerJoin(
      schema.users,
      eq(schema.users.id, schema.taskInstances.assignedUserId),
    )
    .where(
      and(
        eq(schema.taskInstances.id, id),
        eq(schema.taskInstances.householdId, householdId),
      ),
    )
    .limit(1);
  if (!row) return null;

  const items = await db
    .select()
    .from(schema.checklistItems)
    .where(eq(schema.checklistItems.templateId, row.templateId))
    .orderBy(asc(schema.checklistItems.sortOrder));

  const completions = await db
    .select()
    .from(schema.checklistCompletions)
    .where(eq(schema.checklistCompletions.instanceId, row.id));

  const completedItemIds = new Set(completions.map((c) => c.checklistItemId));
  return {
    ...row,
    items: items.map((i) => ({
      id: i.id,
      label: i.label,
      sortOrder: i.sortOrder,
      done: completedItemIds.has(i.id),
    })),
  };
}

export type TaskDetail = NonNullable<Awaited<ReturnType<typeof getTaskInstance>>>;

export async function listOverdueTasks(householdId: string, today: string) {
  return db
    .select({
      id: schema.taskInstances.id,
      scheduledFor: schema.taskInstances.scheduledFor,
      templateName: schema.taskTemplates.name,
      areaIcon: schema.areas.icon,
      assigneeName: schema.users.displayName,
      assigneeColor: schema.users.avatarColor,
    })
    .from(schema.taskInstances)
    .innerJoin(
      schema.taskTemplates,
      eq(schema.taskTemplates.id, schema.taskInstances.templateId),
    )
    .innerJoin(schema.areas, eq(schema.areas.id, schema.taskTemplates.areaId))
    .innerJoin(
      schema.users,
      eq(schema.users.id, schema.taskInstances.assignedUserId),
    )
    .where(
      and(
        eq(schema.taskInstances.householdId, householdId),
        lt(schema.taskInstances.scheduledFor, today),
        inArray(schema.taskInstances.status, ["pending", "in_progress"]),
      ),
    )
    .orderBy(desc(schema.taskInstances.scheduledFor));
}
