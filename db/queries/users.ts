import "server-only";
import { eq, asc } from "drizzle-orm";
import { db, schema } from "@/db/client";

export async function listHouseholdMembers(householdId: string) {
  return db
    .select()
    .from(schema.users)
    .where(eq(schema.users.householdId, householdId))
    .orderBy(asc(schema.users.role), asc(schema.users.displayName));
}

export async function getUserById(id: string) {
  const [row] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .limit(1);
  return row ?? null;
}
