"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { messages } from "@/lib/messages";
import {
  updateTemplate,
  deleteTemplate,
  saveChecklist,
} from "../actions";
import { toast } from "sonner";

interface Item {
  id: string;
  label: string;
  sortOrder: number;
}

interface Props {
  template: {
    id: string;
    name: string;
    description: string | null;
    expectedDurationMinutes: number;
    expectedCadenceDays: number | null;
    areaId: string;
    items: Item[];
  };
  areas: { id: string; name: string; expectedCadenceDays: number }[];
  canEdit: boolean;
}

interface DraftItem {
  // Existing items keep their id; new ones are tagged with `new-<n>` until save.
  key: string;
  id: string | null;
  label: string;
}

export function TemplateEditor({ template, areas, canEdit }: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [items, setItems] = useState<DraftItem[]>(
    template.items.map((i) => ({ key: i.id, id: i.id, label: i.label })),
  );
  const [areaId, setAreaId] = useState(template.areaId);
  const areaCadence =
    areas.find((a) => a.id === areaId)?.expectedCadenceDays ?? null;

  function addItem() {
    setItems((prev) => [
      ...prev,
      { key: `new-${prev.length}-${Date.now()}`, id: null, label: "" },
    ]);
  }

  function updateItem(key: string, label: string) {
    setItems((prev) =>
      prev.map((i) => (i.key === key ? { ...i, label } : i)),
    );
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  function moveItem(key: string, dir: -1 | 1) {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.key === key);
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  }

  function handleMetaSave(formData: FormData) {
    formData.set("id", template.id);
    startTransition(async () => {
      const result = await updateTemplate(formData);
      if (result?.error) toast.error(result.error);
      else toast.success("Saved");
    });
  }

  function handleChecklistSave() {
    startTransition(async () => {
      const result = await saveChecklist(
        template.id,
        items
          .map((i) => i.label.trim())
          .filter(Boolean)
          .map((label, idx) => ({ label, sortOrder: idx })),
      );
      if (result?.error) toast.error(result.error);
      else toast.success("Checklist saved");
    });
  }

  function handleDelete() {
    if (!confirm("Delete this template? Pending tasks using it stay around."))
      return;
    startTransition(async () => {
      const result = await deleteTemplate(template.id);
      if (result?.error) toast.error(result.error);
      else router.push("/templates");
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{template.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handleMetaSave} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="name">{messages.templates.name}</Label>
              <Input
                id="name"
                name="name"
                defaultValue={template.name}
                disabled={!canEdit}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="area_id">{messages.templates.area}</Label>
                <Select
                  id="area_id"
                  name="area_id"
                  value={areaId}
                  onChange={(e) => setAreaId(e.target.value)}
                  disabled={!canEdit}
                >
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">{messages.templates.duration}</Label>
                <Input
                  id="duration"
                  name="duration"
                  type="number"
                  min={1}
                  max={480}
                  defaultValue={template.expectedDurationMinutes}
                  disabled={!canEdit}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cadence">{messages.templates.cadence}</Label>
              <Input
                id="cadence"
                name="cadence"
                type="number"
                min={1}
                max={365}
                defaultValue={template.expectedCadenceDays ?? ""}
                placeholder={
                  areaCadence != null ? `Area: ${areaCadence}d` : ""
                }
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">
                {messages.templates.description}
              </Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={template.description ?? ""}
                disabled={!canEdit}
              />
            </div>
            {canEdit && (
              <div className="flex justify-between">
                <Button type="submit" disabled={pending}>
                  {messages.templates.save}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={pending}
                >
                  {messages.templates.delete}
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {messages.templates.checklist}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.map((it, idx) => (
            <div key={it.key} className="flex items-center gap-2">
              <Input
                value={it.label}
                onChange={(e) => updateItem(it.key, e.target.value)}
                placeholder={`Step ${idx + 1}`}
                disabled={!canEdit}
              />
              {canEdit && (
                <>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => moveItem(it.key, -1)}
                    aria-label="Move up"
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => moveItem(it.key, 1)}
                    aria-label="Move down"
                  >
                    ↓
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => removeItem(it.key)}
                    aria-label="Remove"
                  >
                    ✕
                  </Button>
                </>
              )}
            </div>
          ))}
          {canEdit && (
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={addItem}>
                {messages.templates.addItem}
              </Button>
              <Button
                type="button"
                onClick={handleChecklistSave}
                disabled={pending}
              >
                {messages.templates.save}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
