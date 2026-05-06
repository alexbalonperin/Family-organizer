"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { messages, AVATAR_COLORS } from "@/lib/messages";
import { createHousehold, joinHousehold } from "./actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function OnboardingForm({
  defaultDisplayName,
}: {
  defaultDisplayName: string;
}) {
  const [mode, setMode] = useState<"create" | "join">("create");
  const [pending, startTransition] = useTransition();
  const [color, setColor] = useState<string>(AVATAR_COLORS[0].hex);

  function handleSubmit(formData: FormData) {
    formData.set("avatar_color", color);
    startTransition(async () => {
      const action = mode === "create" ? createHousehold : joinHousehold;
      const result = await action(formData);
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex gap-2">
          <Button
            type="button"
            variant={mode === "create" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("create")}
          >
            {messages.onboarding.chooseCreate}
          </Button>
          <Button
            type="button"
            variant={mode === "join" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("join")}
          >
            {messages.onboarding.chooseJoin}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="display_name">Your name</Label>
            <Input
              id="display_name"
              name="display_name"
              defaultValue={defaultDisplayName}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Pick a color</Label>
            <div className="flex flex-wrap gap-2">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColor(c.hex)}
                  className={cn(
                    "h-9 w-9 rounded-full border-2 transition",
                    color === c.hex
                      ? "border-foreground scale-110"
                      : "border-transparent",
                  )}
                  style={{ backgroundColor: c.hex }}
                  aria-label={c.id}
                  aria-pressed={color === c.hex}
                />
              ))}
            </div>
          </div>

          {mode === "create" ? (
            <div className="space-y-2">
              <Label htmlFor="household_name">Household name</Label>
              <Input
                id="household_name"
                name="household_name"
                placeholder={messages.onboarding.householdNamePlaceholder}
                required
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="invite_code">Invite code</Label>
              <Input
                id="invite_code"
                name="invite_code"
                placeholder={messages.onboarding.inviteCodePlaceholder}
                required
                style={{ textTransform: "uppercase" }}
              />
            </div>
          )}

          <Button type="submit" disabled={pending} className="w-full" size="lg">
            {mode === "create"
              ? messages.onboarding.createCta
              : messages.onboarding.joinCta}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
