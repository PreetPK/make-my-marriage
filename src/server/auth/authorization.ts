import "server-only";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { findActiveStaff } from "@/features/accounts/server/repository";
import { authOptions, staffAuthReady } from "./config";
import { getToken } from "next-auth/jwt";
import { headers, cookies } from "next/headers";

export async function requireStaff() {
  if (!staffAuthReady()) redirect("/login");
  const session = await getServerSession(authOptions());
  if (!session?.user?.id) redirect("/login");
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
  if (!user) redirect("/login");
  return {
    id: user._id.toHexString(),
    name: user.name,
    email: user.email,
    role: user.role,
  };
}
