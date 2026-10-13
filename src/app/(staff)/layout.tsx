import { AuthHistoryGuard } from "@/features/accounts/components/auth-history-guard";
export const dynamic = "force-dynamic";
import type { ReactNode } from "react";
import { requireStaff } from "@/server/auth/authorization";
import { redirect } from "next/navigation";
import { getOnboarding } from "@/features/wedding-onboarding/server/service";
import { SignOutButton } from "@/features/accounts/components/sign-out-button";
export default async function StaffLayout({
  children,
}: {
  children: ReactNode;
}) {
  const staff = await requireStaff();
  if (staff.role === "admin" && !(await getOnboarding(staff)).complete)
    redirect("/onboarding");
  return (
    <AuthHistoryGuard>
      <div className="min-h-svh">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-bronze/20 px-6 py-5">
          <span className="font-serif text-xl">
            Make My Marriage · {staff.role === "admin" ? "Admin" : "Organizer"}
          </span>
          <SignOutButton />
        </header>
        <main className="mx-auto max-w-5xl px-6 py-12">{children}</main>
      </div>
    </AuthHistoryGuard>
  );
}
