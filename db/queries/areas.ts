import "server-only";
import { eq, asc } from "drizzle-orm";
import { db, schema } from "@/db/client";

export async function listAreas(householdId: string) {
  return db
    .select({
      id: schema.areas.id,
      name: schema.areas.name,
      icon: schema.areas.icon,
      expectedCadenceDays: schema.areas.expectedCadenceDays,
      sortOrder: schema.areas.sortOrder,
      lastCleanedAt: schema.areaState.lastCleanedAt,
      dirtLevel: schema.areaState.dirtLevel,
    })
    .from(schema.areas)
    .leftJoin(schema.areaState, eq(schema.areaState.areaId, schema.areas.id))
    .where(eq(schema.areas.householdId, householdId))
    .orderBy(asc(schema.areas.sortOrder));
}
