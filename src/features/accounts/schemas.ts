import { z } from "zod";
const email = z
  .string()
  .trim()
  .max(254)
  .pipe(z.email("Please enter a valid email address."));
export const signInFormSchema = z
  .object({
    email,
    password: z.string().min(1, "Enter your password.").max(512),
  })
  .strict();
export const signupFormSchema = signInFormSchema
  .extend({
    name: z.string().trim().min(1, "Enter your name.").max(200),
    password: z
      .string()
      .max(512)
      .refine(
        (value) =>
          Array.from(value).length >= 15 && Array.from(value).length <= 128,
        "Use a password of 15–128 characters.",
      ),
    confirmPassword: z.string().min(1, "Confirm your password.").max(512),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Your passwords do not match.",
  });
