import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db, schema } from "@/db/client";
import { eq } from "drizzle-orm";
import { OnboardingForm } from "./form";
import { messages } from "@/lib/messages";

export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Already a member? Skip onboarding.
  const [existing] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.authUserId, user.id))
    .limit(1);
  if (existing) redirect("/dashboard");

  const defaultName =
    (user.user_metadata?.full_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "Me";

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{messages.onboarding.title}</h1>
          <p className="text-sm text-muted-foreground">
            Create a household for your family, or join one with an invite code.
          </p>
        </div>
        <OnboardingForm defaultDisplayName={defaultName} />
      </div>
    </div>
  );
}
