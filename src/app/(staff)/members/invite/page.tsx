import { redirect } from "next/navigation";
import { requireStaff } from "@/server/auth/authorization";
import { InviteForm } from "@/features/members/components/invite-form";
export const metadata = { title: "Invite member | Make My Marriage" };
export default async function InviteMemberPage() {
  const staff = await requireStaff();
  if (staff.role !== "admin") redirect("/dashboard");
  return <InviteForm />;
}
