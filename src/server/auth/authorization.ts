import "server-only";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { findActiveStaff } from "@/features/accounts/server/repository";
import { authOptions, staffAuthReady } from "./config";
import { getToken } from "next-auth/jwt";
import { headers, cookies } from "next/headers";

// Auth.js validates expiry and current database membership in its JWT callback.
export async function redirectSignedInStaff() {
  if (!staffAuthReady()) return;
  const session = await getServerSession(authOptions());
  if (session?.user?.id) redirect("/dashboard");
}

export async function getCurrentStaff() {
  if (!staffAuthReady()) return null;
  const session = await getServerSession(authOptions());
  if (!session?.user?.id) return null;
  // Read the verified JWT version server-side; it is never a client permission claim.
  const token = await getToken({
    req: {
      headers: Object.fromEntries(await headers()),
      cookies: Object.fromEntries(
        (await cookies()).getAll().map((cookie) => [cookie.name, cookie.value]),
      ),
    } as Parameters<typeof getToken>[0]["req"],
    secret: process.env.NEXTAUTH_SECRET,
  });
  const user =
    token?.sub && typeof token.sessionVersion === "number"
      ? await findActiveStaff(token.sub, token.sessionVersion)
      : null;
  if (!user) return null;
  return {
    id: user._id.toHexString(),
    weddingId: user.weddingId.toHexString(),
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

export type CurrentStaff = NonNullable<
  Awaited<ReturnType<typeof getCurrentStaff>>
>;
export async function requireStaff() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");
  return staff;
}
