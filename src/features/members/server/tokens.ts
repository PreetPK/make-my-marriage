import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
export const INVITATION_LIFETIME_MS = 48 * 60 * 60_000;
export const SEND_RETRY_WINDOW_MS = 23 * 60 * 60_000;
export function invitationToken(id: string) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("Invitation service is not configured.");
  return (
    id +
    "." +
    createHmac("sha256", secret)
      .update("staff-invitation:v1:" + id)
      .digest("hex")
  );
}
export function tokenDigest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export function tokenMatches(token: string, digest: string) {
  const actual = Buffer.from(tokenDigest(token), "hex"),
    expected = Buffer.from(digest, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
