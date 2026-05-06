import Link from "next/link";
import { cn } from "@/lib/utils";
import { AvatarChip } from "@/components/avatar-chip";
import type { TaskListItem } from "@/db/queries/tasks";

interface Props {
  task: TaskListItem;
  highlightUserId?: string;
}

const statusBadge = {
  pending: "",
  in_progress: "bg-amber-100 text-amber-900",
  completed: "bg-emerald-100 text-emerald-900",
  skipped: "bg-zinc-200 text-zinc-700",
};

export function TaskCard({ task, highlightUserId }: Props) {
  const mine = task.assignedUserId === highlightUserId;
  return (
    <Link href={`/tasks/${task.id}`}>
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border bg-card p-3 transition hover:border-foreground/30",
          mine && "ring-2 ring-primary/40",
        )}
      >
        <span className="text-2xl" aria-hidden>
          {task.areaIcon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{task.templateName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {task.areaName} · ~{task.durationMin} min
          </p>
        </div>
        <div className="flex items-center gap-2">
          {task.status !== "pending" && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] uppercase",
                statusBadge[task.status],
              )}
            >
              {task.status.replace("_", " ")}
            </span>
          )}
          <AvatarChip
            displayName={task.assigneeName}
            color={task.assigneeColor}
            size="sm"
          />
        </div>
      </div>
    </Link>
  );
}
