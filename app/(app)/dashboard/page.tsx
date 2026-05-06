import { getCurrentUserOrRedirect } from "@/lib/auth";
import { listAreas } from "@/db/queries/areas";
import { listTasks, listOverdueTasks } from "@/db/queries/tasks";
import { messages } from "@/lib/messages";
import { jstDateString } from "@/lib/tz";
import { DirtGrid } from "@/components/dirt-grid";
import { TaskCard } from "@/components/task-card";
import type { DirtLevel } from "@/lib/dirt";

export default async function DashboardPage() {
  const me = await getCurrentUserOrRedirect();
  const today = jstDateString();
  const tomorrow = jstDateString(new Date(Date.now() + 24 * 60 * 60 * 1000));

  const [areas, todays, overdue] = await Promise.all([
    listAreas(me.householdId),
    listTasks({
      householdId: me.householdId,
      fromDate: today,
      toDate: tomorrow,
    }),
    listOverdueTasks(me.householdId, today),
  ]);

  const mine = todays.filter((t) => t.assignedUserId === me.id);
  const others = todays.filter((t) => t.assignedUserId !== me.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{messages.dashboard.title}</h1>
        <p className="text-sm text-muted-foreground">
          {me.household.name} · {me.displayName}
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">
          {messages.dashboard.dirtTitle}
        </h2>
        <DirtGrid
          areas={areas.map((a) => ({
            id: a.id,
            name: a.name,
            icon: a.icon,
            dirtLevel: (a.dirtLevel ?? 4) as DirtLevel,
          }))}
        />
      </section>

      {overdue.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase text-rose-700">
            {messages.dashboard.overdue} ({overdue.length})
          </h2>
          <ul className="space-y-2">
            {overdue.slice(0, 5).map((t) => (
              <li key={t.id} className="rounded-lg border bg-rose-50/50 p-3">
                <p className="text-sm font-medium">
                  {t.areaIcon} {t.templateName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t.scheduledFor} · {t.assigneeName}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">
          {messages.dashboard.mine}
        </h2>
        {mine.length === 0 ? (
          <p className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
            Nothing on your list. Take a breath.
          </p>
        ) : (
          <ul className="space-y-2">
            {mine.map((t) => (
              <li key={t.id}>
                <TaskCard task={t} highlightUserId={me.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {others.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground">
            {messages.dashboard.everyone}
          </h2>
          <ul className="space-y-2">
            {others.map((t) => (
              <li key={t.id}>
                <TaskCard task={t} highlightUserId={me.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {todays.length === 0 && overdue.length === 0 && (
        <p className="rounded-lg border bg-emerald-50/40 p-6 text-center text-sm">
          {messages.dashboard.empty}
        </p>
      )}
    </div>
  );
}
