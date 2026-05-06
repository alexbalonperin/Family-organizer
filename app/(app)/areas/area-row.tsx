"use client";

import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { messages } from "@/lib/messages";
import { updateArea } from "./actions";
import { toast } from "sonner";

interface Props {
  id: string;
  name: string;
  icon: string;
  dirtLevel: 0 | 1 | 2 | 3 | 4;
  dirtIcon: string;
  canEdit: boolean;
}

export function AreaRow(props: Props) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSave(formData: FormData) {
    formData.set("id", props.id);
    startTransition(async () => {
      const result = await updateArea(formData);
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Saved");
        setEditing(false);
      }
    });
  }

  return (
    <Card>
      <CardContent className="p-4">
        {editing ? (
          <form action={handleSave} className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1 space-y-2">
                <Label htmlFor={`icon-${props.id}`}>{messages.areas.icon}</Label>
                <Input
                  id={`icon-${props.id}`}
                  name="icon"
                  defaultValue={props.icon}
                  maxLength={4}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor={`name-${props.id}`}>Name</Label>
                <Input
                  id={`name-${props.id}`}
                  name="name"
                  defaultValue={props.name}
                  required
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={pending}>
                {messages.areas.save}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl" aria-hidden>
                {props.icon}
              </span>
              <div>
                <p className="font-medium">{props.name}</p>
                <p className="text-xs text-muted-foreground">{props.dirtIcon}</p>
              </div>
            </div>
            {props.canEdit && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(true)}
              >
                Edit
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
