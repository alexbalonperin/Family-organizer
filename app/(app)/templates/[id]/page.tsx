import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUserOrRedirect } from "@/lib/auth";
import { getTemplate } from "@/db/queries/templates";
import { listAreas } from "@/db/queries/areas";
import { listSchedulesForTemplate } from "@/db/queries/schedules";
import { listHouseholdMembers } from "@/db/queries/users";
import { Button } from "@/components/ui/button";
import { TemplateEditor } from "./template-editor";
import { SchedulesPanel } from "./schedules-panel";

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await getCurrentUserOrRedirect();
  const [template, areas, schedules, members] = await Promise.all([
    getTemplate(me.householdId, id),
    listAreas(me.householdId),
    listSchedulesForTemplate(me.householdId, id),
    listHouseholdMembers(me.householdId),
  ]);
  if (!template) notFound();
  const isParent = me.role === "parent";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/templates">
          <Button variant="ghost" size="sm">
            ← Templates
          </Button>
        </Link>
      </div>

      <TemplateEditor
        template={template}
        areas={areas.map(({ id, name }) => ({ id, name }))}
        canEdit={isParent}
      />

      <SchedulesPanel
        templateId={template.id}
        schedules={schedules}
        members={members.map((m) => ({
          id: m.id,
          displayName: m.displayName,
          avatarColor: m.avatarColor,
        }))}
        canEdit={isParent}
      />
    </div>
  );
}
