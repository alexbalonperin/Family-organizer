"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { messages } from "@/lib/messages";
import { urlBase64ToUint8Array } from "@/lib/push/vapid";
import { savePushSubscription, deletePushSubscription, sendTestPush } from "./actions";
import { toast } from "sonner";

interface Props {
  vapidPublicKey: string;
  subscribedCount: number;
}

export function PushToggle({ vapidPublicKey, subscribedCount }: Props) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | "unknown">(
    "unknown",
  );
  const [thisDevice, setThisDevice] = useState<PushSubscription | null>(null);
  const [pending, startTransition] = useTransition();
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window;
    setSupported(ok);
    if (!ok) {
      const ua = navigator.userAgent || "";
      const isIos = /iPhone|iPad|iPod/i.test(ua);
      const isStandalone =
        // iOS Safari uses navigator.standalone
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        window.matchMedia("(display-mode: standalone)").matches;
      setIosHint(isIos && !isStandalone);
      return;
    }
    setPermission(Notification.permission);
    navigator.serviceWorker.getRegistration("/sw.js").then(async (reg) => {
      const sub = await reg?.pushManager.getSubscription();
      setThisDevice(sub ?? null);
    });
  }, []);

  async function enable() {
    if (!vapidPublicKey) {
      toast.error("Server is missing NEXT_PUBLIC_VAPID_PUBLIC_KEY.");
      return;
    }
    startTransition(async () => {
      try {
        const reg =
          (await navigator.serviceWorker.getRegistration("/sw.js")) ??
          (await navigator.serviceWorker.register("/sw.js"));
        await navigator.serviceWorker.ready;
        const perm = await Notification.requestPermission();
        setPermission(perm);
        if (perm !== "granted") {
          toast.error("Permission denied.");
          return;
        }
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
            .buffer as ArrayBuffer,
        });
        const json = sub.toJSON();
        const result = await savePushSubscription({
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh ?? "",
          auth: json.keys?.auth ?? "",
        });
        if (result?.error) {
          toast.error(result.error);
          return;
        }
        setThisDevice(sub);
        toast.success("Reminders enabled on this device.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not enable push");
      }
    });
  }

  async function disable() {
    if (!thisDevice) return;
    startTransition(async () => {
      const endpoint = thisDevice.endpoint;
      await thisDevice.unsubscribe();
      await deletePushSubscription(endpoint);
      setThisDevice(null);
      toast.success("Disabled on this device.");
    });
  }

  async function test() {
    startTransition(async () => {
      const r = await sendTestPush();
      if (r?.error) toast.error(r.error);
      else toast.success("Test push queued");
    });
  }

  if (supported === null) return null;

  if (!supported) {
    return (
      <div className="rounded-lg border bg-muted/40 p-3 text-sm">
        Push is not supported in this browser.
        {iosHint && (
          <p className="mt-2 text-muted-foreground">
            {messages.settings.iosHint}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">
            {thisDevice
              ? messages.settings.pushEnabled
              : messages.settings.enablePush}
          </p>
          <p className="text-xs text-muted-foreground">
            {subscribedCount} device{subscribedCount === 1 ? "" : "s"} subscribed
          </p>
        </div>
        {thisDevice ? (
          <Button onClick={disable} disabled={pending} variant="outline">
            Disable
          </Button>
        ) : (
          <Button onClick={enable} disabled={pending}>
            Enable
          </Button>
        )}
      </div>
      {thisDevice && (
        <Button onClick={test} variant="ghost" size="sm" disabled={pending}>
          {messages.settings.testPush}
        </Button>
      )}
      {permission === "denied" && (
        <p className="text-xs text-rose-700">
          Notifications are blocked in this browser. Re-enable from site
          settings.
        </p>
      )}
    </div>
  );
}
