import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireStaff } from "@/server/auth/authorization";
import { AuthHistoryGuard } from "@/features/accounts/components/auth-history-guard";
import { OnboardingForm } from "@/features/wedding-onboarding/components/onboarding-form";
import {
  onboardingChoices,
  weddingSettingsSchema,
} from "@/features/wedding-onboarding/schemas";
import { getOnboarding } from "@/features/wedding-onboarding/server/service";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Wedding setup | Make My Marriage" };
export default async function OnboardingPage() {
  const staff = await requireStaff();
  if (staff.role !== "admin") redirect("/dashboard");
  const initial = await getOnboarding(staff);
  if (initial.complete) redirect("/dashboard");
  const choices = onboardingChoices();
  if (
    initial.values.timeZone &&
    weddingSettingsSchema.shape.timeZone.safeParse(initial.values.timeZone)
      .success &&
    !choices.timeZones.includes(initial.values.timeZone)
  )
    choices.timeZones.push(initial.values.timeZone);
  return (
    <AuthHistoryGuard>
      <OnboardingForm initial={initial} choices={choices} />
    </AuthHistoryGuard>
  );
}
