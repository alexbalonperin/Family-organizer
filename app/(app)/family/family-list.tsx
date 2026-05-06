"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { AvatarChip } from "@/components/avatar-chip";
import { messages, AVATAR_COLORS } from "@/lib/messages";
import type { User } from "@/db/schema";
import { addMember, removeMember } from "./actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  members: User[];
  canEdit: boolean;
  myUserId: string;
}

export function FamilyList({ members, canEdit, myUserId }: Props) {
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();
  const [color, setColor] = useState<string>(AVATAR_COLORS[1].hex);

  function handleAdd(formData: FormData) {
    formData.set("avatar_color", color);
    startTransition(async () => {
      const result = await addMember(formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Member added");
        setAdding(false);
      }
    });
  }

  function handleRemove(id: string) {
    if (!confirm(messages.family.removeConfirm)) return;
    startTransition(async () => {
      const result = await removeMember(id);
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <div className="space-y-3">
      {members.map((m) => (
        <Card key={m.id}>
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <AvatarChip
                displayName={m.displayName}
                color={m.avatarColor}
                size="md"
              />
              <div>
                <p className="font-medium">
                  {m.displayName}
                  {m.id === myUserId && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (you)
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {m.role === "parent"
                    ? messages.family.parent
                    : messages.family.child}
                  {!m.authUserId && m.role === "child" && " · shadow"}
                </p>
              </div>
            </div>
            {canEdit && m.id !== myUserId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemove(m.id)}
                disabled={pending}
              >
                {messages.family.remove}
              </Button>
            )}
          </CardContent>
        </Card>
      ))}

      {canEdit && (
        <>
          {adding ? (
            <Card>
              <CardContent className="space-y-3 p-4">
                <form action={handleAdd} className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="display_name">
                      {messages.family.displayName}
                    </Label>
                    <Input
                      id="display_name"
                      name="display_name"
                      required
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">{messages.family.role}</Label>
                    <Select id="role" name="role" defaultValue="child">
                      <option value="parent">{messages.family.parent}</option>
                      <option value="child">{messages.family.child}</option>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{messages.family.color}</Label>
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
                        />
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="birthdate">{messages.family.birthdate}</Label>
                    <Input id="birthdate" name="birthdate" type="date" />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={pending}>
                      {messages.family.save}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setAdding(false)}
                    >
                      {messages.family.cancel}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Button onClick={() => setAdding(true)} className="w-full">
              {messages.family.add}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
