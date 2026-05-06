"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { messages } from "@/lib/messages";
import {
  expandSchedule,
  buildWeeklyRrule,
  buildDailyRrule,
} from "@/lib/rrule/expand";
import {
  saveSchedule,
  deleteSchedule,
  toggleScheduleActive,
} from "../actions";
import { toast } from "sonner";
import type { TaskSchedule } from "@/db/schema";
import { AvatarChip } from "@/components/avatar-chip";

interface Props {
  templateId: string;
  schedules: TaskSchedule[];
  members: { id: string; displayName: string; avatarColor: string }[];
  canEdit: boolean;
}

const DAY_OPTIONS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;
const DAY_LABEL: Record<(typeof DAY_OPTIONS)[number], string> = {
  MO: "Mon",
  TU: "Tue",
  WE: "Wed",
  TH: "Thu",
  FR: "Fri",
  SA: "Sat",
  SU: "Sun",
};

export function SchedulesPanel({
  templateId,
  schedules,
  members,
  canEdit,
}: Props) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const router = useRouter();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{messages.templates.schedules}</CardTitle>
          {canEdit && editing === null && (
            <Button size="sm" onClick={() => setEditing("new")}>
              {messages.schedules.new}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {schedules.length === 0 && editing === null && (
          <p className="text-sm text-muted-foreground">
            No schedules yet. Add one to start generating tasks.
          </p>
        )}

        {schedules.map((s) =>
          editing === s.id ? (
            <ScheduleForm
              key={s.id}
              templateId={templateId}
              members={members}
              initial={s}
              onClose={() => {
                setEditing(null);
                router.refresh();
              }}
            />
          ) : (
            <ScheduleRow
              key={s.id}
              schedule={s}
              members={members}
              canEdit={canEdit}
              onEdit={() => setEditing(s.id)}
            />
          ),
        )}

        {editing === "new" && (
          <ScheduleForm
            templateId={templateId}
            members={members}
            onClose={() => {
              setEditing(null);
              router.refresh();
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}

function ScheduleRow({
  schedule,
  members,
  canEdit,
  onEdit,
}: {
  schedule: TaskSchedule;
  members: { id: string; displayName: string; avatarColor: string }[];
  canEdit: boolean;
  onEdit: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const assignedMembers = members.filter((m) =>
    schedule.assigneeUserIds.includes(m.id),
  );

  function handleDelete() {
    if (!confirm("Delete this schedule? Pending future tasks will be removed."))
      return;
    startTransition(async () => {
      const r = await deleteSchedule(schedule.id);
      if (r?.error) toast.error(r.error);
      else router.refresh();
    });
  }

  function handleToggle() {
    startTransition(async () => {
      const r = await toggleScheduleActive(schedule.id, !schedule.active);
      if (r?.error) toast.error(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="rounded-lg border p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-mono text-xs text-muted-foreground">
            {schedule.rruleString?.split("\n").pop()}
          </p>
          <p>
            <span className="font-medium">
              {schedule.assignmentPolicy.replace("_", " ")}
            </span>
            {!schedule.active && (
              <span className="ml-2 rounded bg-muted px-2 py-0.5 text-xs">
                paused
              </span>
            )}
          </p>
          <div className="flex flex-wrap gap-1">
            {assignedMembers.map((m) => (
              <AvatarChip
                key={m.id}
                displayName={m.displayName}
                color={m.avatarColor}
                size="xs"
              />
            ))}
          </div>
          {schedule.nextOccurrences.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Next: {schedule.nextOccurrences.slice(0, 5).join(", ")}
            </p>
          )}
        </div>
        {canEdit && (
          <div className="flex flex-col gap-1">
            <Button size="sm" variant="ghost" onClick={onEdit}>
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleToggle}
              disabled={pending}
            >
              {schedule.active ? "Pause" : "Resume"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDelete}
              disabled={pending}
            >
              Delete
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ScheduleForm({
  templateId,
  members,
  initial,
  onClose,
}: {
  templateId: string;
  members: { id: string; displayName: string; avatarColor: string }[];
  initial?: TaskSchedule;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [freq, setFreq] = useState<"DAILY" | "WEEKLY">(
    initial?.rruleString?.includes("FREQ=DAILY") ? "DAILY" : "WEEKLY",
  );
  const [byDay, setByDay] = useState<string[]>(() => {
    const m = initial?.rruleString?.match(/BYDAY=([A-Z,]+)/);
    return m ? m[1].split(",") : ["MO"];
  });
  const [policy, setPolicy] = useState<TaskSchedule["assignmentPolicy"]>(
    initial?.assignmentPolicy ?? "fixed",
  );
  const [assigneeIds, setAssigneeIds] = useState<string[]>(
    initial?.assigneeUserIds ?? [members[0]?.id].filter(Boolean) as string[],
  );
  const [advanced, setAdvanced] = useState(false);
  const [advancedRrule, setAdvancedRrule] = useState(
    initial?.rruleString ?? "",
  );

  const rrule = useMemo(() => {
    if (advanced) return advancedRrule;
    const start = new Date();
    if (freq === "DAILY") return buildDailyRrule(start);
    return buildWeeklyRrule({
      byDay: byDay as ("MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU")[],
      startDate: start,
    });
  }, [freq, byDay, advanced, advancedRrule]);

  const preview = useMemo(() => {
    try {
      return expandSchedule(rrule, new Date(), 30).slice(0, 5);
    } catch {
      return [];
    }
  }, [rrule]);

  function toggleDay(d: string) {
    setByDay((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    );
  }

  function toggleAssignee(id: string) {
    setAssigneeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function handleSave() {
    if (assigneeIds.length === 0) {
      toast.error("Pick at least one assignee.");
      return;
    }
    startTransition(async () => {
      const result = await saveSchedule({
        templateId,
        scheduleId: initial?.id ?? null,
        rruleString: rrule,
        assignmentPolicy: policy,
        assigneeUserIds: assigneeIds,
        active: initial?.active ?? true,
      });
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Saved");
        onClose();
      }
    });
  }

  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <div className="space-y-3">
        <div className="space-y-2">
          <Label>{messages.schedules.rrule}</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={freq === "DAILY" && !advanced ? "default" : "outline"}
              onClick={() => {
                setAdvanced(false);
                setFreq("DAILY");
              }}
            >
              {messages.schedules.daily}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={freq === "WEEKLY" && !advanced ? "default" : "outline"}
              onClick={() => {
                setAdvanced(false);
                setFreq("WEEKLY");
              }}
            >
              {messages.schedules.weekly}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={advanced ? "default" : "outline"}
              onClick={() => setAdvanced((v) => !v)}
            >
              {messages.schedules.rruleAdvanced}
            </Button>
          </div>
          {!advanced && freq === "WEEKLY" && (
            <div className="flex flex-wrap gap-1 pt-2">
              {DAY_OPTIONS.map((d) => (
                <Button
                  key={d}
                  type="button"
                  size="sm"
                  variant={byDay.includes(d) ? "default" : "outline"}
                  onClick={() => toggleDay(d)}
                >
                  {DAY_LABEL[d]}
                </Button>
              ))}
            </div>
          )}
          {advanced && (
            <textarea
              className="w-full rounded-md border p-2 font-mono text-xs"
              rows={3}
              value={advancedRrule}
              onChange={(e) => setAdvancedRrule(e.target.value)}
              placeholder="DTSTART:20260501T050000&#10;RRULE:FREQ=WEEKLY;BYDAY=MO"
            />
          )}
        </div>

        <div className="space-y-2">
          <Label>{messages.schedules.policy}</Label>
          <Select
            value={policy}
            onChange={(e) =>
              setPolicy(e.target.value as TaskSchedule["assignmentPolicy"])
            }
          >
            <option value="fixed">{messages.schedules.fixed}</option>
            <option value="round_robin">{messages.schedules.roundRobin}</option>
            <option value="load_balanced">{messages.schedules.loadBalanced}</option>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{messages.schedules.assignees}</Label>
          <div className="space-y-1">
            {members.map((m) => (
              <label
                key={m.id}
                className="flex items-center gap-2 rounded p-1 hover:bg-background"
              >
                <Checkbox
                  checked={assigneeIds.includes(m.id)}
                  onChange={() => toggleAssignee(m.id)}
                />
                <AvatarChip
                  displayName={m.displayName}
                  color={m.avatarColor}
                  size="xs"
                />
                <span>{m.displayName}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>{messages.schedules.preview}</Label>
          {preview.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No upcoming dates from this rule.
            </p>
          ) : (
            <ul className="text-sm">
              {preview.map((d) => (
                <li key={d} className="font-mono">
                  {d}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-between">
          <Button onClick={handleSave} disabled={pending}>
            {messages.schedules.save}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
