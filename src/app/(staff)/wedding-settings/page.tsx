import { Suspense } from "react";
import { WeddingSettingsLoading } from "@/features/wedding-settings/components/settings-loading";
import type { CurrentStaff } from "@/server/auth/authorization";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireStaff } from "@/server/auth/authorization";
import { getWeddingSettings } from "@/features/wedding-settings/server/service";
import { WeddingSettingsForm } from "@/features/wedding-settings/components/settings-form";
import { onboardingChoices } from "@/features/wedding-onboarding/schemas";
export const metadata: Metadata = {
  title: "Wedding Settings | Make My Marriage",
  robots: { index: false, follow: false },
};
export default async function WeddingSettingsPage() {
  const staff = await requireStaff();
  if (staff.role !== "admin") redirect("/dashboard");
  return (
    <Suspense fallback={<WeddingSettingsLoading />}>
      <SettingsContent staff={staff} />
    </Suspense>
  );
}
async function SettingsContent({ staff }: { staff: CurrentStaff }) {
  const initial = await getWeddingSettings(staff);
  const choices = onboardingChoices();
  if (!choices.timeZones.includes(initial.values.timeZone))
    choices.timeZones.push(initial.values.timeZone);
  return <WeddingSettingsForm initial={initial} choices={choices} />;
}
