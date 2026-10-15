import "server-only";
import { z } from "zod";
const configuration = z.object({
  key: z.string().min(1),
  from: z
    .string()
    .trim()
    .min(1)
    .max(320)
    .refine((value) => {
      const address = /<([^<>]+)>$/.exec(value)?.[1] ?? value;
      return z.email().safeParse(address).success && !/[\r\n]/.test(value);
    }),
  url: z.url({ protocol: /^https?$/ }).refine((value) => {
    const url = new URL(value);
    return (
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash
    );
  }),
});
export function invitationEmailConfiguration() {
  const parsed = configuration.safeParse({
    key: process.env.RESEND_API_KEY,
    from: process.env.STAFF_EMAIL_FROM,
    url: process.env.APP_URL ?? process.env.NEXTAUTH_URL,
  });
  if (!parsed.success)
    throw new Error(
      "Configure RESEND_API_KEY, STAFF_EMAIL_FROM and APP_URL before sending invitations.",
    );
  return parsed.data;
}
export async function sendStaffInvitation(input: {
  id: string;
  email: string;
  role: string;
  token: string;
  expiresAt: Date;
}) {
  const { key, from, url } = invitationEmailConfiguration();
  const link = new URL("/accept-invitation", url);
  link.searchParams.set("token", input.token);
  // A text message avoids interpolating user-controlled markup into HTML.
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
      "Idempotency-Key": "staff-invitation/" + input.id,
    },
    body: JSON.stringify({
      from,
      to: [input.email],
      subject: "Your Make My Marriage invitation",
      text: `You have been invited as a ${input.role} to a wedding workspace.\n\nAccept your invitation: ${link.href}\n\nThis link expires at ${input.expiresAt.toISOString()} and can be used once. If you were not expecting it, ignore this email.`,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new Error(
      "Email could not be sent. Check the sender configuration and recipient, then retry.",
    );
  const body = z
    .object({ id: z.string().min(1) })
    .safeParse(await response.json());
  if (!body.success)
    throw new Error("Email provider did not confirm the request.");
  return body.data.id;
}
