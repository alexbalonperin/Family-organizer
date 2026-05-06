import "server-only";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db, schema } from "@/db/client";
import type { User, Household } from "@/db/schema";

export interface CurrentUser extends User {
  household: Household;
}

// Resolves the current authenticated user + their household. Redirects to
// /login if no session, /onboarding if no membership row.
export async function getCurrentUserOrRedirect(): Promise<CurrentUser> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const [member] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.authUserId, authUser.id))
    .limit(1);
  if (!member) redirect("/onboarding");

  const [household] = await db
    .select()
    .from(schema.households)
    .where(eq(schema.households.id, member.householdId))
    .limit(1);
  if (!household) redirect("/onboarding");

  return { ...member, household };
}

// Defense-in-depth check for parent-only Server Actions.
export function assertParent(user: CurrentUser) {
  if (user.role !== "parent") {
    throw new Error("forbidden: parent role required");
  }
}
