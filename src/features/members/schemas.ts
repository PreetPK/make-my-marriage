import { z } from "zod";
import { signupFormSchema } from "@/features/accounts/schemas";
export const inviteMemberSchema = z
  .object({
    email: z
      .string()
      .trim()
      .max(254)
      .pipe(z.email("Enter a valid email address.")),
    role: z.enum(["coowner", "organizer"]),
    clientRequestId: z.uuid(),
  })
  .strict();
export const invitationTokenSchema = z
  .string()
  .regex(/^[a-f0-9]{24}\.[a-f0-9]{64}$/);
export const acceptInvitationSchema = signupFormSchema.safeExtend({
  token: invitationTokenSchema,
});
export type MemberRow = {
  id: string;
  name: string;
  email: string;
  label: string;
  status: string;
  revocable: boolean;
};
export type InvitationRow = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  delivery: string;
  retryable: boolean;
};
