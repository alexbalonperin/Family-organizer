import { DIRT_ICONS } from "@/lib/messages";
import type { DirtLevel } from "@/lib/dirt";
import { cn } from "@/lib/utils";

interface Area {
  id: string;
  name: string;
  icon: string;
  dirtLevel: DirtLevel;
}

const ringByLevel: Record<DirtLevel, string> = {
  0: "ring-emerald-200 bg-emerald-50",
  1: "ring-emerald-100 bg-emerald-50",
  2: "ring-amber-200 bg-amber-50",
  3: "ring-orange-300 bg-orange-50",
  4: "ring-rose-300 bg-rose-50",
};

export function DirtGrid({ areas }: { areas: Area[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {areas.map((a) => (
        <li
          key={a.id}
          className={cn(
            "flex flex-col items-center justify-center gap-1 rounded-xl p-4 ring-1",
            ringByLevel[a.dirtLevel],
          )}
        >
          <span className="text-3xl" aria-hidden>
            {DIRT_ICONS[a.dirtLevel]}
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            {a.icon} {a.name}
          </span>
        </li>
      ))}
    </ul>
  );
}
