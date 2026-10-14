import "server-only";
import type { JWT } from "next-auth/jwt";
type StaffToken = JWT & {
  sub: string;
  sessionVersion: number;
  staffIssuedAt: number;
};
// Shared by the Auth.js session callback and direct protected-request reads.
// getToken authenticates/decrypts the JWT and checks its exp before this policy.
export function isCurrentStaffToken(
  token: JWT | null,
  now = Date.now(),
): token is StaffToken {
  if (
    !token ||
    typeof token.sub !== "string" ||
    typeof token.sessionVersion !== "number" ||
    !Number.isSafeInteger(token.sessionVersion) ||
    token.sessionVersion < 1 ||
    typeof token.staffIssuedAt !== "number" ||
    !Number.isFinite(token.staffIssuedAt)
  )
    return false;
  const age = now - token.staffIssuedAt;
  return age >= 0 && age < 12 * 60 * 60_000;
}
