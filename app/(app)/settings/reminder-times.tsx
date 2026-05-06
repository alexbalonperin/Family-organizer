"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { messages } from "@/lib/messages";
import { saveReminderSettings } from "./actions";
import { toast } from "sonner";

interface Props {
  morning: string;
  evening: string;
  enabled: boolean;
}

export function ReminderTimes({ morning, evening, enabled }: Props) {
  const [pending, startTransition] = useTransition();
  const [m, setM] = useState(morning.slice(0, 5));
  const [e, setE] = useState(evening.slice(0, 5));
  const [on, setOn] = useState(enabled);

  function handleSave() {
    startTransition(async () => {
      const result = await saveReminderSettings({
        morning: m,
        evening: e,
        enabled: on,
      });
      if (result?.error) toast.error(result.error);
      else toast.success("Reminder times saved");
    });
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={on}
          onChange={(ev) => setOn(ev.target.checked)}
        />
        Enable reminders for this account
      </label>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="morning">{messages.settings.morning}</Label>
          <Input
            id="morning"
            type="time"
            value={m}
            onChange={(ev) => setM(ev.target.value)}
            disabled={!on}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="evening">{messages.settings.evening}</Label>
          <Input
            id="evening"
            type="time"
            value={e}
            onChange={(ev) => setE(ev.target.value)}
            disabled={!on}
          />
        </div>
      </div>
      <Button onClick={handleSave} disabled={pending}>
        {messages.settings.saveTimes}
      </Button>
    </div>
  );
}
