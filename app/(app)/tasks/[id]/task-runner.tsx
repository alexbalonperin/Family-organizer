"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AvatarChip } from "@/components/avatar-chip";
import { messages } from "@/lib/messages";
import {
  startTask,
  toggleChecklistItem,
  completeTask,
  skipTask,
  setNotes,
} from "./actions";
import type { TaskDetail } from "@/db/queries/tasks";
import { toast } from "sonner";

interface Props {
  task: TaskDetail;
  members: { id: string; displayName: string; avatarColor: string }[];
  currentUserId: string;
  canManage: boolean;
}

function formatDuration(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TaskRunner({ task, members, currentUserId, canManage }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState(() => Date.now());
  const [completedBy, setCompletedBy] = useState(
    task.completedByUserId ?? currentUserId,
  );
  const [notes, setNotesLocal] = useState(task.notes ?? "");

  // Live timer while in_progress.
  useEffect(() => {
    if (task.status !== "in_progress") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [task.status]);

  const startedMs = task.startedAt ? new Date(task.startedAt).getTime() : null;
  const elapsed =
    task.status === "completed" && task.startedAt && task.completedAt
      ? new Date(task.completedAt).getTime() -
        new Date(task.startedAt).getTime()
      : startedMs && task.status === "in_progress"
        ? now - startedMs
        : 0;

  function handleStart() {
    startTransition(async () => {
      const r = await startTask(task.id);
      if (r?.error) toast.error(r.error);
      else router.refresh();
    });
  }

  function handleToggle(itemId: string, done: boolean) {
    startTransition(async () => {
      const r = await toggleChecklistItem(task.id, itemId, done);
      if (r?.error) toast.error(r.error);
      else router.refresh();
    });
  }

  function handleComplete() {
    startTransition(async () => {
      const r = await completeTask(task.id, completedBy, notes);
      if (r?.error) toast.error(r.error);
      else {
        toast.success("Done!");
        router.refresh();
      }
    });
  }

  function handleSkip() {
    if (!confirm("Mark this task as skipped?")) return;
    startTransition(async () => {
      const r = await skipTask(task.id);
      if (r?.error) toast.error(r.error);
      else router.refresh();
    });
  }

  function saveNotes() {
    startTransition(async () => {
      const r = await setNotes(task.id, notes);
      if (r?.error) toast.error(r.error);
      else toast.success("Notes saved");
    });
  }

  const isPending = task.status === "pending";
  const isRunning = task.status === "in_progress";
  const isDone = task.status === "completed" || task.status === "skipped";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl">
                {task.areaIcon} {task.templateName}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {task.areaName} · ~{task.durationMin} min · {task.scheduledFor}
              </p>
            </div>
            <AvatarChip
              displayName={task.assigneeName}
              color={task.assigneeColor}
              size="md"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {task.templateDescription && (
            <p className="text-sm text-muted-foreground">
              {task.templateDescription}
            </p>
          )}

          <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
            <div>
              <p className="text-xs uppercase text-muted-foreground">
                {messages.tasks.duration}
              </p>
              <p
                className="font-mono text-2xl"
                aria-live={isRunning ? "polite" : "off"}
              >
                {formatDuration(elapsed)}
              </p>
            </div>
            <div className="flex gap-2">
              {isPending && canManage && (
                <Button onClick={handleStart} disabled={pending} size="lg">
                  {messages.tasks.start}
                </Button>
              )}
              {(isRunning || isPending) && canManage && (
                <Button
                  onClick={handleSkip}
                  disabled={pending}
                  variant="ghost"
                >
                  {messages.tasks.skip}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Checklist · {task.items.filter((i) => i.done).length}/
            {task.items.length}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {task.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {messages.tasks.noChecklist}
            </p>
          ) : (
            <ul className="space-y-2">
              {task.items.map((it) => (
                <li key={it.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-muted/40">
                    <Checkbox
                      checked={it.done}
                      disabled={!canManage || isDone}
                      onChange={(e) =>
                        handleToggle(it.id, e.currentTarget.checked)
                      }
                    />
                    <span className={it.done ? "line-through opacity-60" : ""}>
                      {it.label}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {!isDone && canManage && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="space-y-2">
              <Label htmlFor="completed_by">{messages.tasks.completedBy}</Label>
              <Select
                id="completed_by"
                value={completedBy}
                onChange={(e) => setCompletedBy(e.target.value)}
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">{messages.tasks.notes}</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotesLocal(e.target.value)}
                placeholder="Anything worth remembering for next time?"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={saveNotes}
                disabled={pending}
              >
                Save notes
              </Button>
            </div>
            <Button
              onClick={handleComplete}
              disabled={pending}
              size="lg"
              className="w-full"
            >
              {messages.tasks.done}
            </Button>
          </CardContent>
        </Card>
      )}

      {isDone && (
        <Card>
          <CardContent className="space-y-2 p-4 text-sm">
            <p>
              <span className="font-medium">Status:</span> {task.status}
            </p>
            {task.completedAt && (
              <p>
                <span className="font-medium">Completed:</span>{" "}
                {new Date(task.completedAt).toLocaleString()}
              </p>
            )}
            {task.notes && (
              <p>
                <span className="font-medium">Notes:</span> {task.notes}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
