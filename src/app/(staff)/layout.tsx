import { AuthHistoryGuard } from "@/features/accounts/components/auth-history-guard";
export const dynamic = "force-dynamic";
import type { ReactNode } from "react";
import { requireStaff } from "@/server/auth/authorization";
import { redirect } from "next/navigation";
import { getOnboarding } from "@/features/wedding-onboarding/server/service";
import { StaffNavigation } from "@/features/accounts/components/staff-navigation";
import Link from "next/link";
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
      <div className="min-h-svh md:grid md:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="border-b border-bronze/20 px-6 py-5 md:flex md:min-h-svh md:flex-col md:border-r md:border-b-0 md:py-10">
          <Link
            href="/dashboard"
            className="mb-8 inline-block text-primary"
            aria-label="Make My Marriage dashboard"
          >
            <span className="block text-[10px] tracking-[0.25em] uppercase">
              Make My
            </span>
            <span className="font-serif text-2xl">Marriage</span>
          </Link>
          <StaffNavigation admin={staff.role === "admin"} />
          <div className="mt-4 md:mt-auto md:pt-10">
            <SignOutButton variant="quiet" />
          </div>
        </aside>
        <div className="min-w-0">
          <header className="border-b border-bronze/15 px-6 py-5 text-xs text-secondary md:px-12">
            Wedding workspace · {staff.role === "admin" ? "Admin" : "Organizer"}
          </header>
          <main className="mx-auto max-w-[1040px] px-6 py-10 md:px-12">
            {children}
          </main>
        </div>
      </div>
    </AuthHistoryGuard>
  );
}
