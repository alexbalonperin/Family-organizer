"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select } from "@/components/ui/select";
import { messages } from "@/lib/messages";

interface Props {
  members: { id: string; displayName: string }[];
  areas: { id: string; name: string }[];
  selected: {
    assignee?: string;
    area?: string;
    status?: string;
  };
}

export function CalendarFilters({ members, areas, selected }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function set(key: string, value: string) {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="grid grid-cols-3 gap-2 text-sm">
      <Select
        aria-label={messages.calendar.assignee}
        value={selected.assignee ?? ""}
        onChange={(e) => set("assignee", e.target.value)}
      >
        <option value="">{messages.calendar.assignee}: {messages.calendar.all}</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.displayName}
          </option>
        ))}
      </Select>
      <Select
        aria-label={messages.calendar.area}
        value={selected.area ?? ""}
        onChange={(e) => set("area", e.target.value)}
      >
        <option value="">{messages.calendar.area}: {messages.calendar.all}</option>
        {areas.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </Select>
      <Select
        aria-label={messages.calendar.status}
        value={selected.status ?? ""}
        onChange={(e) => set("status", e.target.value)}
      >
        <option value="">{messages.calendar.status}: {messages.calendar.all}</option>
        <option value="pending">{messages.tasks.pending}</option>
        <option value="in_progress">{messages.tasks.inProgress}</option>
        <option value="completed">{messages.tasks.completed}</option>
        <option value="skipped">{messages.tasks.skipped}</option>
      </Select>
    </div>
  );
}
