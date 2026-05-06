"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { messages } from "@/lib/messages";
import { createOneOffTask } from "./actions";
import { toast } from "sonner";
import { jstDateString } from "@/lib/tz";

interface Props {
  templates: { id: string; name: string; areaName: string }[];
  members: { id: string; displayName: string }[];
}

export function NewTaskButton({ templates, members }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handle(formData: FormData) {
    startTransition(async () => {
      const result = await createOneOffTask(formData);
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Task created");
        setOpen(false);
      }
    });
  }

  if (!open) {
    return <Button onClick={() => setOpen(true)}>{messages.tasks.new}</Button>;
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <p className="font-semibold">{messages.tasks.new}</p>
      </CardHeader>
      <CardContent>
        <form action={handle} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="template_id">{messages.templates.title}</Label>
            <Select id="template_id" name="template_id" required>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.areaName} · {t.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="assigned_user_id">Assignee</Label>
            <Select id="assigned_user_id" name="assigned_user_id" required>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="scheduled_for">Date</Label>
            <Input
              id="scheduled_for"
              name="scheduled_for"
              type="date"
              defaultValue={jstDateString()}
              required
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              Create
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
