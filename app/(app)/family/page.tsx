import { getCurrentUserOrRedirect } from "@/lib/auth";
import { listHouseholdMembers } from "@/db/queries/users";
import { messages } from "@/lib/messages";
import { FamilyList } from "./family-list";
import { InviteCodeDisplay } from "./invite-code";

export default async function FamilyPage() {
  const me = await getCurrentUserOrRedirect();
  const members = await listHouseholdMembers(me.householdId);
  const isParent = me.role === "parent";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{messages.family.title}</h1>
        <p className="text-sm text-muted-foreground">{me.household.name}</p>
      </div>

      <InviteCodeDisplay code={me.household.inviteCode} />

      <FamilyList members={members} canEdit={isParent} myUserId={me.id} />
    </div>
  );
}
