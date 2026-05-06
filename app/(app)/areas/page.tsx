import { getCurrentUserOrRedirect } from "@/lib/auth";
import { listAreas } from "@/db/queries/areas";
import { messages, DIRT_ICONS } from "@/lib/messages";
import { AreaRow } from "./area-row";
import { NewAreaButton } from "./new-area-button";

export default async function AreasPage() {
  const me = await getCurrentUserOrRedirect();
  const areas = await listAreas(me.householdId);
  const isParent = me.role === "parent";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{messages.areas.title}</h1>
          <p className="text-sm text-muted-foreground">
            Group your chores. Cadence lives on each template.
          </p>
        </div>
        {isParent && <NewAreaButton />}
      </div>

      <ul className="space-y-2">
        {areas.map((a) => (
          <AreaRow
            key={a.id}
            id={a.id}
            name={a.name}
            icon={a.icon}
            dirtLevel={(a.dirtLevel ?? 4) as 0 | 1 | 2 | 3 | 4}
            dirtIcon={DIRT_ICONS[(a.dirtLevel ?? 4) as 0 | 1 | 2 | 3 | 4]}
            canEdit={isParent}
          />
        ))}
      </ul>
    </div>
  );
}
