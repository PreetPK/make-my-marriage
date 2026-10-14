import "server-only";
import { cache } from "react";
import { isCurrentStaffToken } from "./token-policy";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { findActiveStaff } from "@/features/accounts/server/repository";
import { authOptions, staffAuthReady } from "./config";
import { getToken } from "next-auth/jwt";
import { cookies } from "next/headers";

// Auth.js validates expiry and current database membership in its JWT callback.
export async function redirectSignedInStaff() {
  if (!staffAuthReady()) return;
  const session = await getServerSession(authOptions());
  if (session?.user?.id) redirect("/dashboard");
}

// React shares this result only inside one Server Component request. Route
// handlers have no React cache context and always perform fresh authorization.
export const getCurrentStaff = cache(async function readCurrentStaff() {
  if (!staffAuthReady()) return null;
  try {
    // Avoid running the session callback's database check and then repeating it.
    // Auth.js still decrypts/verifies the native session token; apply the same
    // absolute-lifetime policy and current database membership below.
    const token = await getToken({
      req: {
        // Staff access remains cookie-based; do not enable bearer-token login.
        headers: {},
        cookies: Object.fromEntries(
          (await cookies())
            .getAll()
            .map((cookie) => [cookie.name, cookie.value]),
        ),
      } as Parameters<typeof getToken>[0]["req"],
      secret: process.env.NEXTAUTH_SECRET,
    });
    if (!isCurrentStaffToken(token)) return null;
    const user = await findActiveStaff(token.sub, token.sessionVersion);
    if (!user) return null;
    return {
      id: user._id.toHexString(),
      weddingId: user.weddingId.toHexString(),
      name: user.name,
      email: user.email,
      role: user.role,
    };
  } catch {
    // An outage cannot establish current access. Preserve fail-closed page/API
    // behavior without exposing driver errors or database configuration.
    return null;
  }
});

export type CurrentStaff = NonNullable<
  Awaited<ReturnType<typeof getCurrentStaff>>
>;
export async function requireStaff() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");
  return staff;
}
