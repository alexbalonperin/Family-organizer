"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { messages } from "@/lib/messages";
import { createArea } from "./actions";
import { toast } from "sonner";

export function NewAreaButton() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createArea(formData);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Area added");
      setOpen(false);
    });
  }

  if (!open) {
    return <Button onClick={() => setOpen(true)}>New area</Button>;
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <p className="font-semibold">New area</p>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1 space-y-2">
              <Label htmlFor="new-area-icon">{messages.areas.icon}</Label>
              <Input
                id="new-area-icon"
                name="icon"
                defaultValue="🧹"
                maxLength={4}
                required
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="new-area-name">Name</Label>
              <Input id="new-area-name" name="name" required autoFocus />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {messages.areas.save}
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
