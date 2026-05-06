import Link from "next/link";
import { getCurrentUserOrRedirect } from "@/lib/auth";
import { signOut } from "@/app/login/actions";
import { AvatarChip } from "@/components/avatar-chip";
import { Button } from "@/components/ui/button";
import { messages } from "@/lib/messages";

const NAV = [
  { href: "/dashboard", label: "Today" },
  { href: "/tasks", label: "Tasks" },
  { href: "/calendar", label: "Calendar" },
  { href: "/templates", label: "Templates" },
  { href: "/areas", label: "Areas" },
  { href: "/family", label: "Family" },
  { href: "/settings", label: "Settings" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUserOrRedirect();

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4">
          <Link href="/dashboard" className="font-semibold">
            {messages.app.name}
          </Link>
          <nav className="hidden flex-1 items-center justify-center gap-4 text-sm md:flex">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="text-muted-foreground hover:text-foreground"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <AvatarChip
              displayName={user.displayName}
              color={user.avatarColor}
              size="sm"
            />
            <form action={signOut}>
              <Button variant="ghost" size="sm" type="submit">
                {messages.auth.signOut}
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-5 border-t bg-background/95 backdrop-blur md:hidden">
        {NAV.slice(0, 5).map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className="flex flex-col items-center justify-center py-2 text-[11px] text-muted-foreground hover:text-foreground"
          >
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
