import Link from "next/link";
import { getCurrentStaff } from "@/server/auth/authorization";
import { invitationDetails } from "@/features/members/server/service";
import { AcceptForm } from "@/features/members/components/accept-form";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Accept invitation | Make My Marriage",
  referrer: "no-referrer" as const,
  robots: { index: false, follow: false },
};
export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const token = (await searchParams).token;
  const staff = await getCurrentStaff();
  if (staff)
    return (
      <section>
        <h2 className="font-serif text-2xl text-primary">
          You are already signed in
        </h2>
        <p className="mt-4 text-sm leading-6 text-secondary">
          Each account belongs to one wedding. Sign out before accepting an
          invitation for another email address.
        </p>
        <Link
          href="/dashboard"
          className="mt-5 inline-flex min-h-11 items-center underline"
        >
          Open your workspace
        </Link>
      </section>
    );
  let details;
  try {
    details = typeof token === "string" ? await invitationDetails(token) : null;
  } catch {
    return (
      <section>
        <h2 className="font-serif text-2xl text-primary">
          Invitation service unavailable
        </h2>
        <p className="mt-4 text-sm text-secondary">
          Please reload this page to try again.
        </p>
      </section>
    );
  }
  if (!details || typeof token !== "string")
    return (
      <section>
        <h2 className="font-serif text-2xl text-primary">
          Invitation unavailable
        </h2>
        <p className="mt-4 text-sm leading-6 text-secondary">
          This link may have expired, been cancelled or already been used. Ask
          your wedding admin for help.
        </p>
        <Link
          href="/login"
          className="mt-5 inline-flex min-h-11 items-center underline"
        >
          Already accepted? Sign in
        </Link>
      </section>
    );
  return <AcceptForm token={token} {...details} />;
}
