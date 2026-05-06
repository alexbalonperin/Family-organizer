"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { messages, AVATAR_COLORS } from "@/lib/messages";

const colorIds = AVATAR_COLORS.map((c) => c.hex) as [string, ...string[]];

const createSchema = z.object({
  household_name: z.string().min(1).max(80),
  display_name: z.string().min(1).max(80),
  avatar_color: z.enum(colorIds),
});

const joinSchema = z.object({
  invite_code: z.string().min(4).max(20),
  display_name: z.string().min(1).max(80),
  avatar_color: z.enum(colorIds),
});

export async function createHousehold(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = createSchema.safeParse({
    household_name: formData.get("household_name"),
    display_name: formData.get("display_name"),
    avatar_color: formData.get("avatar_color"),
  });
  if (!parsed.success) return { error: messages.onboarding.createError };

  const { error } = await supabase.rpc("seed_household", {
    p_household_name: parsed.data.household_name,
    p_owner_auth_user_id: user.id,
    p_owner_display_name: parsed.data.display_name,
    p_owner_avatar_color: parsed.data.avatar_color,
  });

  if (error) return { error: error.message || messages.onboarding.createError };
  redirect("/dashboard");
}

export async function joinHousehold(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = joinSchema.safeParse({
    invite_code: (formData.get("invite_code") as string)?.toUpperCase().trim(),
    display_name: formData.get("display_name"),
    avatar_color: formData.get("avatar_color"),
  });
  if (!parsed.success) return { error: messages.onboarding.joinError };

  const { error } = await supabase.rpc("join_household", {
    p_invite_code: parsed.data.invite_code,
    p_display_name: parsed.data.display_name,
    p_avatar_color: parsed.data.avatar_color,
  });

  if (error) return { error: error.message || messages.onboarding.joinError };
  redirect("/dashboard");
}
