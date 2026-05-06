import { getCurrentUserOrRedirect } from "@/lib/auth";
import { listTasks } from "@/db/queries/tasks";
import { listTemplatesWithArea } from "@/db/queries/templates";
import { listHouseholdMembers } from "@/db/queries/users";
import { jstDateString } from "@/lib/tz";
import { messages } from "@/lib/messages";
import { TaskCard } from "@/components/task-card";
import { NewTaskButton } from "./new-task-button";

export default async function TasksPage() {
  const me = await getCurrentUserOrRedirect();
  const today = jstDateString();
  const horizon = jstDateString(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  );

  const [tasks, templates, members] = await Promise.all([
    listTasks({
      householdId: me.householdId,
      fromDate: today,
      toDate: horizon,
    }),
    listTemplatesWithArea(me.householdId),
    listHouseholdMembers(me.householdId),
  ]);

  // Group by date.
  const byDay = new Map<string, typeof tasks>();
  for (const t of tasks) {
    const list = byDay.get(t.scheduledFor) ?? [];
    list.push(t);
    byDay.set(t.scheduledFor, list);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{messages.tasks.upcoming}</h1>
          <p className="text-sm text-muted-foreground">Next 30 days.</p>
        </div>
        {me.role === "parent" && (
          <NewTaskButton
            templates={templates.map((t) => ({
              id: t.id,
              name: t.name,
              areaName: t.areaName,
            }))}
            members={members.map((m) => ({
              id: m.id,
              displayName: m.displayName,
            }))}
          />
        )}
      </div>

      {byDay.size === 0 ? (
        <p className="rounded-lg border bg-muted/40 p-6 text-sm text-muted-foreground">
          No upcoming tasks. Add a schedule on a template to populate.
        </p>
      ) : (
        Array.from(byDay.entries()).map(([day, list]) => (
          <section key={day} className="space-y-2">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground">
              {day}
            </h2>
            <ul className="space-y-2">
              {list.map((t) => (
                <li key={t.id}>
                  <TaskCard task={t} highlightUserId={me.id} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
