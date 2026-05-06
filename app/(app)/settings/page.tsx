import { getCurrentUserOrRedirect } from "@/lib/auth";
import {
  getUserSettings,
  listMyPushSubscriptions,
} from "@/db/queries/settings";
import { messages } from "@/lib/messages";
import { signOut } from "@/app/login/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReminderTimes } from "./reminder-times";
import { PushToggle } from "./push-toggle";

export default async function SettingsPage() {
  const me = await getCurrentUserOrRedirect();
  const [settings, subs] = await Promise.all([
    getUserSettings(me.id),
    listMyPushSubscriptions(me.id),
  ]);
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{messages.settings.title}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {messages.settings.notifications}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <PushToggle
            vapidPublicKey={vapidPublicKey}
            subscribedCount={subs.length}
          />
          <ReminderTimes
            morning={settings.morningReminderTime}
            evening={settings.eveningReminderTime}
            enabled={settings.remindersEnabled}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Account</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={signOut}>
            <Button variant="outline" type="submit">
              {messages.auth.signOut}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
