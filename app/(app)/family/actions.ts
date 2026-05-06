"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { getCurrentUserOrRedirect, assertParent } from "@/lib/auth";
import { AVATAR_COLORS, messages } from "@/lib/messages";

const colorIds = AVATAR_COLORS.map((c) => c.hex) as [string, ...string[]];

const addSchema = z.object({
  display_name: z.string().min(1).max(80),
  role: z.enum(["parent", "child"]),
  avatar_color: z.enum(colorIds),
  birthdate: z.string().optional(),
});

export async function addMember(formData: FormData) {
  const me = await getCurrentUserOrRedirect();
  try {
    assertParent(me);
  } catch {
    return { error: messages.errors.notAllowed };
  }

  const parsed = addSchema.safeParse({
    display_name: formData.get("display_name"),
    role: formData.get("role"),
    avatar_color: formData.get("avatar_color"),
    birthdate: formData.get("birthdate") || undefined,
  });
  if (!parsed.success) return { error: messages.errors.generic };

  await db.insert(schema.users).values({
    householdId: me.householdId,
    authUserId: null,
    displayName: parsed.data.display_name,
    role: parsed.data.role,
    avatarColor: parsed.data.avatar_color,
    birthdate: parsed.data.birthdate || null,
  });

  revalidatePath("/family");
  return { ok: true };
}

export async function removeMember(userId: string) {
  const me = await getCurrentUserOrRedirect();
  try {
    assertParent(me);
  } catch {
    return { error: messages.errors.notAllowed };
  }
  if (userId === me.id) return { error: "You cannot remove yourself." };

  // Defensive: ensure target is in same household.
  const [target] = await db
    .select()
    .from(schema.users)
    .where(
      and(
        eq(schema.users.id, userId),
        eq(schema.users.householdId, me.householdId),
      ),
    )
    .limit(1);
  if (!target) return { error: messages.errors.notFound };

  await db.delete(schema.users).where(eq(schema.users.id, userId));
  revalidatePath("/family");
  return { ok: true };
}
