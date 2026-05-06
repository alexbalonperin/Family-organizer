"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { jstDateString } from "@/lib/tz";
import type { TaskListItem } from "@/db/queries/tasks";
import { messages } from "@/lib/messages";

interface Props {
  year: number;
  month: number; // 1..12
  tasks: TaskListItem[];
}

export function CalendarMonth({ year, month, tasks }: Props) {
  // Group tasks by yyyy-MM-dd.
  const byDay = useMemo(() => {
    const m = new Map<string, TaskListItem[]>();
    for (const t of tasks) {
      const list = m.get(t.scheduledFor) ?? [];
      list.push(t);
      m.set(t.scheduledFor, list);
    }
    return m;
  }, [tasks]);

  // Build the grid: 6 rows × 7 cols, week starts on Monday.
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  // getUTCDay: 0=Sun..6=Sat. Convert to Mon-first: 0=Mon..6=Sun.
  const firstWeekday = (firstOfMonth.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const cells: { date: string | null }[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push({ date: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${month.toString().padStart(2, "0")}-${d
      .toString()
      .padStart(2, "0")}`;
    cells.push({ date });
  }
  while (cells.length % 7 !== 0) cells.push({ date: null });

  const today = jstDateString();
  const [openDay, setOpenDay] = useState<string | null>(null);

  return (
    <>
      {/* Desktop month grid */}
      <div className="hidden md:block">
        <div className="grid grid-cols-7 gap-px rounded-lg border bg-border text-center text-[11px] font-medium uppercase text-muted-foreground">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="bg-background py-1">
              {d}
            </div>
          ))}
          {cells.map((c, i) => {
            const list = c.date ? byDay.get(c.date) ?? [] : [];
            const isToday = c.date === today;
            return (
              <div
                key={i}
                className={cn(
                  "min-h-24 bg-background p-1 text-left",
                  !c.date && "bg-muted/40",
                  isToday && "ring-2 ring-primary ring-inset",
                )}
              >
                {c.date && (
                  <>
                    <div className="text-xs font-semibold">
                      {parseInt(c.date.slice(8), 10)}
                    </div>
                    <ul className="space-y-0.5">
                      {list.slice(0, 3).map((t) => (
                        <li key={t.id}>
                          <Link
                            href={`/tasks/${t.id}`}
                            className="block truncate rounded px-1 text-[11px]"
                            style={{ backgroundColor: t.assigneeColor + "33" }}
                            title={`${t.templateName} · ${t.assigneeName}`}
                          >
                            <span
                              className="inline-block h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: t.assigneeColor }}
                            />{" "}
                            {t.templateName}
                          </Link>
                        </li>
                      ))}
                      {list.length > 3 && (
                        <li>
                          <button
                            onClick={() => setOpenDay(c.date)}
                            className="text-[10px] text-muted-foreground hover:underline"
                          >
                            +{list.length - 3} {messages.calendar.more}
                          </button>
                        </li>
                      )}
                    </ul>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile: vertical list of days that have tasks */}
      <div className="space-y-3 md:hidden">
        {cells
          .filter((c) => c.date && (byDay.get(c.date)?.length ?? 0) > 0)
          .map((c) => {
            const date = c.date!;
            const list = byDay.get(date) ?? [];
            const isToday = date === today;
            return (
              <section
                key={date}
                className={cn(
                  "rounded-lg border p-3",
                  isToday && "border-primary",
                )}
              >
                <p className="mb-2 text-sm font-semibold">{date}</p>
                <ul className="space-y-1">
                  {list.map((t) => (
                    <li key={t.id}>
                      <Link
                        href={`/tasks/${t.id}`}
                        className="flex items-center gap-2 rounded px-2 py-1"
                        style={{ backgroundColor: t.assigneeColor + "22" }}
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: t.assigneeColor }}
                        />
                        <span className="flex-1 truncate text-sm">
                          {t.templateName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {t.assigneeName}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        {tasks.length === 0 && (
          <p className="rounded-lg border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
            No tasks this month.
          </p>
        )}
      </div>

      {/* Day-overflow modal (desktop) */}
      {openDay && (
        <DayOverflow
          date={openDay}
          tasks={byDay.get(openDay) ?? []}
          onClose={() => setOpenDay(null)}
        />
      )}
    </>
  );
}

function DayOverflow({
  date,
  tasks,
  onClose,
}: {
  date: string;
  tasks: TaskListItem[];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg bg-background p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-2 font-semibold">{date}</p>
        <ul className="space-y-1">
          {tasks.map((t) => (
            <li key={t.id}>
              <Link
                href={`/tasks/${t.id}`}
                className="flex items-center gap-2 rounded p-1 hover:bg-muted"
                onClick={onClose}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: t.assigneeColor }}
                />
                <span className="flex-1 truncate text-sm">
                  {t.templateName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t.assigneeName}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
