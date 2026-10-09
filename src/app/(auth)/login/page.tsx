import type { Metadata } from "next";
import { StaffAccessForm } from "@/features/accounts/components/staff-access-form";

export const metadata: Metadata = { title: "Sign in | Make My Marriage" };

import { staffAuthReady } from "@/server/auth/config";
export const dynamic = "force-dynamic";
export default function LoginPage() {
  return <StaffAccessForm mode="login" available={staffAuthReady()} />;
}
