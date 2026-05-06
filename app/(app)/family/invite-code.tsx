"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { messages } from "@/lib/messages";

export function InviteCodeDisplay({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div>
          <p className="text-xs uppercase text-muted-foreground">
            {messages.family.inviteCode}
          </p>
          <p className="font-mono text-lg tracking-wider">{code}</p>
        </div>
        <Button variant="outline" size="sm" onClick={copy}>
          {copied ? messages.family.copied : messages.family.copy}
        </Button>
      </CardContent>
    </Card>
  );
}
