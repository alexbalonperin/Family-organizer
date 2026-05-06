import Link from "next/link";
import { getCurrentUserOrRedirect } from "@/lib/auth";
import { listTasks } from "@/db/queries/tasks";
import { listAreas } from "@/db/queries/areas";
import { listHouseholdMembers } from "@/db/queries/users";
import { Button } from "@/components/ui/button";
import { jstDateString } from "@/lib/tz";
import { messages } from "@/lib/messages";
import { CalendarFilters } from "./calendar-filters";
import { CalendarMonth } from "./calendar-month";

interface SearchParams {
  month?: string; // yyyy-MM
  assignee?: string;
  area?: string;
  status?: string;
}

function parseMonth(input: string | undefined): { year: number; month: number } {
  if (input && /^\d{4}-\d{2}$/.test(input)) {
    const [y, m] = input.split("-").map(Number);
    return { year: y, month: m };
  }
  // Default to JST current month.
  const [y, m] = jstDateString().split("-").map(Number);
  return { year: y, month: m };
}

function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const me = await getCurrentUserOrRedirect();
  const { year, month } = parseMonth(sp.month);

  const startDate = `${year}-${month.toString().padStart(2, "0")}-01`;
  const next = shiftMonth(year, month, 1);
  const endExclusiveDate = `${next.year}-${next.month
    .toString()
    .padStart(2, "0")}-01`;

  const [tasks, areas, members] = await Promise.all([
    listTasks({
      householdId: me.householdId,
      fromDate: startDate,
      toDate: endExclusiveDate,
      assigneeId: sp.assignee || undefined,
      areaId: sp.area || undefined,
      status: (sp.status as
        | "pending"
        | "in_progress"
        | "completed"
        | "skipped"
        | undefined) || undefined,
    }),
    listAreas(me.householdId),
    listHouseholdMembers(me.householdId),
  ]);

  const prev = shiftMonth(year, month, -1);
  const todayParam = jstDateString().slice(0, 7);
  const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleString(
    "en-US",
    { month: "long", year: "numeric", timeZone: "UTC" },
  );

  function withMonth(m: { year: number; month: number }) {
    const params = new URLSearchParams();
    params.set("month", `${m.year}-${m.month.toString().padStart(2, "0")}`);
    if (sp.assignee) params.set("assignee", sp.assignee);
    if (sp.area) params.set("area", sp.area);
    if (sp.status) params.set("status", sp.status);
    return `/calendar?${params.toString()}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{messages.calendar.title}</h1>
        <div className="flex items-center gap-1">
          <Link href={withMonth(prev)}>
            <Button size="icon" variant="ghost" aria-label="Previous month">
              ‹
            </Button>
          </Link>
          <Link
            href={withMonth(parseMonth(todayParam))}
            className="rounded-md px-3 py-1 text-sm hover:bg-muted"
          >
            {messages.calendar.today}
          </Link>
          <Link href={withMonth(next)}>
            <Button size="icon" variant="ghost" aria-label="Next month">
              ›
            </Button>
          </Link>
        </div>
      </div>

      <p className="text-sm font-medium text-muted-foreground">{monthLabel}</p>

      <CalendarFilters
        members={members.map((m) => ({
          id: m.id,
          displayName: m.displayName,
        }))}
        areas={areas.map((a) => ({ id: a.id, name: a.name }))}
        selected={{
          assignee: sp.assignee,
          area: sp.area,
          status: sp.status,
        }}
      />

      <CalendarMonth year={year} month={month} tasks={tasks} />
    </div>
  );
}
