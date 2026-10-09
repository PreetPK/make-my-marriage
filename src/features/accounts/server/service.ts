import "server-only";
import { createHash } from "node:crypto";
import { ObjectId } from "mongodb";
import { signupFormSchema } from "../schemas";
import {
  accountCollections,
  allowAccountAttempt,
  ensureAccountStorage,
} from "./repository";
import { hashPassword } from "./password";
export function digestToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export class AccountInputError extends Error {}
export async function signupAdmin(input: unknown) {
  const values = signupFormSchema.safeParse(input);
  if (!values.success)
    throw new AccountInputError("Check your signup details.");
  await ensureAccountStorage();
  const { name, email, password } = values.data;
  const emailNormalized = email.toLowerCase();
  if (
    !(await allowAccountAttempt("signup:global", 120, 15 * 60_000)) ||
    !(await allowAccountAttempt(
      "signup:" + digestToken(emailNormalized),
      10,
      15 * 60_000,
    ))
  )
    throw new AccountInputError("Too many attempts. Please try again later.");
  const { database, users } = await accountCollections();
  if (await users.findOne({ emailNormalized }))
    throw new AccountInputError(
      "An account already exists for this email. Sign in to your account.",
    );
  const passwordHash = await hashPassword(password);
  // Reserve only the singleton's setup identity. Wedding names, timezone and
  // currency are configured later, never inferred from the sample homepage.
  const now = new Date();
  const wedding = await database.collection("weddings").findOneAndUpdate(
    { singletonKey: "primary" },
    {
      $setOnInsert: {
        singletonKey: "primary",
        status: "setup",
        createdAt: now,
        updatedAt: now,
        schemaVersion: 1,
        revision: 1,
      },
    },
    { upsert: true, returnDocument: "after" },
  );
  if (!wedding || !["setup", "active"].includes(wedding.status))
    throw new AccountInputError("This wedding workspace is unavailable.");
  try {
    await users.insertOne({
      _id: new ObjectId(),
      weddingId: wedding._id,
      name,
      email,
      emailNormalized,
      role: "admin",
      status: "active",
      credential: { passwordHash, changedAt: now },
      sessionVersion: 1,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === 11000)
      throw new AccountInputError(
        "An account already exists for this email. Sign in to your account.",
      );
    throw error;
  }
  return { message: "Account created. You can now sign in." };
}
