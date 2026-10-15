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
export class AccountRateLimitError extends AccountInputError {}
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
    throw new AccountRateLimitError(
      "Too many attempts. Please try again later.",
    );
  const { database, users } = await accountCollections();
  if (await users.findOne({ emailNormalized }))
    throw new AccountInputError(
      "An account or invitation already exists for this email. Sign in or use your invitation.",
    );
  const passwordHash = await hashPassword(password);
  // Account and owned workspace are committed together. Duplicate signup never
  // leaves an orphan wedding or joins someone else's existing workspace.
  const now = new Date(),
    userId = new ObjectId(),
    weddingId = new ObjectId();
  const session = database.client.startSession();
  try {
    await session.withTransaction(
      async () => {
        await database.collection("weddings").insertOne(
          {
            _id: weddingId,
            ownerUserId: userId,
            status: "setup",
            createdAt: now,
            updatedAt: now,
            schemaVersion: 1,
            revision: 1,
          },
          { session },
        );
        await users.insertOne(
          {
            _id: userId,
            weddingId,
            name,
            email,
            emailNormalized,
            role: "admin",
            status: "active",
            credential: { passwordHash, changedAt: now },
            sessionVersion: 1,
            createdAt: now,
            updatedAt: now,
          },
          { session },
        );
      },
      {
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
        timeoutMS: 30000,
        maxCommitTimeMS: 10000,
      },
    );
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === 11000)
      throw new AccountInputError(
        "An account or invitation already exists for this email. Sign in or use your invitation.",
      );
    throw error;
  } finally {
    await session.endSession();
  }
  return { message: "Account created. You can now sign in." };
}
