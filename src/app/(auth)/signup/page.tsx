import type { Metadata } from "next";
import { StaffAccessForm } from "@/features/accounts/components/staff-access-form";
export const metadata: Metadata = {
  title: "Create account | Make My Marriage",
};
export const dynamic = "force-dynamic";
export default function SignupPage() {
  return <StaffAccessForm mode="signup" />;
}
