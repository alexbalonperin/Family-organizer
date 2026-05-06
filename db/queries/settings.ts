import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";

export async function getUserSettings(userId: string) {
  const [row] = await db
    .select()
    .from(schema.userSettings)
    .where(eq(schema.userSettings.userId, userId))
    .limit(1);
  if (row) return row;
  // Lazy-create defaults.
  const [created] = await db
    .insert(schema.userSettings)
    .values({ userId })
    .returning();
  return created;
}

export async function listMyPushSubscriptions(userId: string) {
  return db
    .select({
      id: schema.pushSubscriptions.id,
      endpoint: schema.pushSubscriptions.endpoint,
      createdAt: schema.pushSubscriptions.createdAt,
    })
    .from(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.userId, userId));
}
