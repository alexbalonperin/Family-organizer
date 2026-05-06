import { getCurrentUserOrRedirect } from "@/lib/auth";
import { messages } from "@/lib/messages";

export default async function DashboardPage() {
  const user = await getCurrentUserOrRedirect();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{messages.dashboard.title}</h1>
        <p className="text-sm text-muted-foreground">
          Welcome, {user.displayName}.
        </p>
      </div>
      <p className="rounded-lg border bg-muted/40 p-6 text-sm text-muted-foreground">
        Today&apos;s tasks, dirt grid, and overdue list arrive in step 4.
      </p>
    </div>
  );
}
