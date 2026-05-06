import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db, schema } from "@/db/client";
import { eq } from "drizzle-orm";

// Root entrypoint. Sends the user to /login, /onboarding, or the dashboard
// depending on whether they have an auth session and a household membership.
export default async function RootPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [member] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.authUserId, user.id))
    .limit(1);

  if (!member) redirect("/onboarding");

  redirect("/dashboard");
}
