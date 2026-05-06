import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUserOrRedirect } from "@/lib/auth";
import { getTemplate } from "@/db/queries/templates";
import { listAreas } from "@/db/queries/areas";
import { Button } from "@/components/ui/button";
import { TemplateEditor } from "./template-editor";

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await getCurrentUserOrRedirect();
  const [template, areas] = await Promise.all([
    getTemplate(me.householdId, id),
    listAreas(me.householdId),
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
    </div>
  );
}
