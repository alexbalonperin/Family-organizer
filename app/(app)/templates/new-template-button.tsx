"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { messages } from "@/lib/messages";
import { createTemplate } from "./actions";
import { toast } from "sonner";

interface Props {
  areas: { id: string; name: string; expectedCadenceDays: number }[];
}

export function NewTemplateButton({ areas }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [areaId, setAreaId] = useState(areas[0]?.id ?? "");
  const areaCadence =
    areas.find((a) => a.id === areaId)?.expectedCadenceDays ?? null;

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createTemplate(formData);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Template created");
      setOpen(false);
      if (result?.id) router.push(`/templates/${result.id}`);
    });
  }

  if (!open) {
    return <Button onClick={() => setOpen(true)}>{messages.templates.new}</Button>;
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <p className="font-semibold">{messages.templates.new}</p>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="name">{messages.templates.name}</Label>
            <Input id="name" name="name" required autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="area_id">{messages.templates.area}</Label>
            <Select
              id="area_id"
              name="area_id"
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
              required
            >
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="duration">{messages.templates.duration}</Label>
              <Input
                id="duration"
                name="duration"
                type="number"
                min={1}
                max={480}
                defaultValue={15}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cadence">{messages.templates.cadence}</Label>
              <Input
                id="cadence"
                name="cadence"
                type="number"
                min={1}
                max={365}
                placeholder={
                  areaCadence != null ? `Area: ${areaCadence}d` : ""
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">{messages.templates.description}</Label>
            <Textarea id="description" name="description" />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {messages.templates.save}
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
