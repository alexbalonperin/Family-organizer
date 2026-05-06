import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUserOrRedirect } from "@/lib/auth";
import { getTaskInstance } from "@/db/queries/tasks";
import { listHouseholdMembers } from "@/db/queries/users";
import { Button } from "@/components/ui/button";
import { TaskRunner } from "./task-runner";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await getCurrentUserOrRedirect();
  const [task, members] = await Promise.all([
    getTaskInstance(me.householdId, id),
    listHouseholdMembers(me.householdId),
  ]);
  if (!task) notFound();

  const canManage = me.role === "parent" || task.assignedUserId === me.id;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/tasks">
          <Button variant="ghost" size="sm">
            ← Tasks
          </Button>
        </Link>
      </div>
      <TaskRunner
        task={task}
        members={members.map((m) => ({
          id: m.id,
          displayName: m.displayName,
          avatarColor: m.avatarColor,
        }))}
        currentUserId={me.id}
        canManage={canManage}
      />
    </div>
  );
}
