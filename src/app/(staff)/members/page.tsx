import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireStaff, type CurrentStaff } from "@/server/auth/authorization";
import { getMembers } from "@/features/members/server/service";
import { MemberActions } from "@/features/members/components/member-actions";
export const metadata = { title: "Members | Make My Marriage" };
export default async function MembersPage() {
  const staff = await requireStaff();
  if (staff.role !== "admin") redirect("/dashboard");
  return (
    <Suspense
      fallback={
        <p role="status" className="text-sm text-secondary">
          Loading members…
        </p>
      }
    >
      <MembersContent staff={staff} />
    </Suspense>
  );
}
async function MembersContent({ staff }: { staff: CurrentStaff }) {
  const state = await getMembers(staff);
  return (
    <section>
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="font-serif text-3xl text-primary">Members</h1>
          <p className="mt-3 text-sm text-secondary">
            Your partner and the people helping you plan.
          </p>
        </div>
        <Link
          href="/members/invite"
          className="inline-flex min-h-11 items-center bg-primary px-5 text-sm text-white"
        >
          Invite member →
        </Link>
      </div>
      <div className="mt-8 overflow-x-auto border border-bronze/20 bg-white">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Wedding members</caption>
          <thead className="bg-panel-light text-xs text-secondary">
            <tr>
              {["Member", "Role", "Status", "Action"].map((title) => (
                <th key={title} scope="col" className="px-5 py-4 font-medium">
                  {title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {state.members.map((member) => (
              <tr key={member.id} className="border-t border-bronze/15">
                <th scope="row" className="px-5 py-5 font-normal">
                  <span className="block font-serif text-lg">
                    {member.name}
                  </span>
                  <span className="text-xs text-secondary">{member.email}</span>
                </th>
                <td className="px-5 py-5">{member.label}</td>
                <td className="px-5 py-5 capitalize">{member.status}</td>
                <td className="px-5 py-5">
                  {member.revocable ? (
                    <MemberActions
                      id={member.id}
                      email={member.email}
                      invitation={false}
                    />
                  ) : (
                    <span className="text-xs text-secondary">
                      {member.status === "revoked"
                        ? "Access removed"
                        : "Admin access"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="mt-10 font-serif text-2xl text-primary">
        Pending invitations
      </h2>
      {state.invitations.length ? (
        <div className="mt-5 overflow-x-auto border border-bronze/20 bg-white">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Pending wedding invitations</caption>
            <thead className="bg-panel-light text-xs text-secondary">
              <tr>
                {[
                  "Email / role",
                  "Email status",
                  "Expires (UTC)",
                  "Action",
                ].map((title) => (
                  <th key={title} scope="col" className="px-5 py-4 font-medium">
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.invitations.map((invite) => (
                <tr key={invite.id} className="border-t border-bronze/15">
                  <th scope="row" className="px-5 py-5 font-normal">
                    {invite.email}
                    <span className="mt-1 block text-xs text-secondary">
                      {invite.role}
                    </span>
                  </th>
                  <td className="px-5 py-5 text-xs">{invite.delivery}</td>
                  <td className="px-5 py-5 text-xs">
                    <time dateTime={invite.expiresAt}>
                      {invite.expiresAt.replace("T", " ").slice(0, 16)}
                    </time>
                  </td>
                  <td className="px-5 py-5">
                    <MemberActions
                      id={invite.id}
                      email={invite.email}
                      invitation
                      retryable={invite.retryable}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-5 border border-bronze/20 bg-white p-8 text-sm text-secondary">
          No pending invitations. Invite your partner as a co-owner or someone
          to help as an organizer.
        </p>
      )}
      <p className="mt-8 text-xs leading-6 text-secondary">
        Co-owners have admin permissions. Organizers have limited access. Owner
        transfer and admin removal are not available yet. Email acceptance by
        the provider does not confirm delivery.
      </p>
    </section>
  );
}
