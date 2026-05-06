import Link from "next/link";
import { getCurrentUserOrRedirect } from "@/lib/auth";
import { listTemplatesWithArea } from "@/db/queries/templates";
import { listAreas } from "@/db/queries/areas";
import { messages } from "@/lib/messages";
import { Card, CardContent } from "@/components/ui/card";
import { NewTemplateButton } from "./new-template-button";

export default async function TemplatesPage() {
  const me = await getCurrentUserOrRedirect();
  const [templates, areas] = await Promise.all([
    listTemplatesWithArea(me.householdId),
    listAreas(me.householdId),
  ]);
  const isParent = me.role === "parent";

  // Group by area for display.
  const byArea = new Map<string, typeof templates>();
  for (const t of templates) {
    const list = byArea.get(t.areaId) ?? [];
    list.push(t);
    byArea.set(t.areaId, list);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{messages.templates.title}</h1>
          <p className="text-sm text-muted-foreground">
            One template per repeating chore. Schedules attach to templates.
          </p>
        </div>
        {isParent && (
          <NewTemplateButton
            areas={areas.map((a) => ({
              id: a.id,
              name: a.name,
              expectedCadenceDays: a.expectedCadenceDays,
            }))}
          />
        )}
      </div>

      <div className="space-y-6">
        {areas.map((a) => {
          const list = byArea.get(a.id) ?? [];
          return (
            <section key={a.id} className="space-y-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase text-muted-foreground">
                <span>{a.icon}</span>
                {a.name}
              </h2>
              {list.length === 0 ? (
                <p className="text-sm text-muted-foreground">No templates.</p>
              ) : (
                <ul className="space-y-2">
                  {list.map((t) => (
                    <li key={t.id}>
                      <Link href={`/templates/${t.id}`}>
                        <Card className="transition hover:border-foreground/30">
                          <CardContent className="flex items-center justify-between p-4">
                            <div>
                              <p className="font-medium">{t.name}</p>
                              <p className="text-xs text-muted-foreground">
                                ~{t.expectedDurationMinutes} min
                              </p>
                            </div>
                            <span aria-hidden className="text-muted-foreground">
                              ›
                            </span>
                          </CardContent>
                        </Card>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
