import "server-only";
import { ObjectId } from "mongodb";
import { getDatabase } from "@/server/db/mongodb";

export type StaffUser = {
  _id: ObjectId;
  weddingId: ObjectId;
  name: string;
  email: string;
  emailNormalized: string;
  role: "admin" | "organizer";
  status: "invited" | "pending_verification" | "active" | "revoked";
  credential?: { passwordHash: string; changedAt: Date };
  emailVerifiedAt?: Date;
  sessionVersion: number;
  createdAt: Date;
  updatedAt: Date;
};
export async function accountCollections() {
  const database = await getDatabase();
  return {
    database,
    users: database.collection<StaffUser>("users"),
  };
}
export async function findStaffByEmail(emailNormalized: string) {
  const { users } = await accountCollections();
  return users.findOne({ emailNormalized });
}
export async function findActiveStaff(id: string, sessionVersion: number) {
  if (!ObjectId.isValid(id) || !Number.isSafeInteger(sessionVersion))
    return null;
  const { users, database } = await accountCollections();
  const user = await users.findOne({
    _id: new ObjectId(id),
    status: "active",
    sessionVersion,
    role: { $in: ["admin", "organizer"] },
  });
  if (!user || !user.credential?.passwordHash) return null;
  const wedding = await database.collection("weddings").findOne({
    _id: user.weddingId,
    singletonKey: "primary",
    status: { $in: ["setup", "active"] },
  });
  return wedding ? user : null;
}
// Shared across processes; no per-instance in-memory login counter.
export async function allowAccountAttempt(
  key: string,
  limit: number,
  windowMs: number,
) {
  const { database } = await accountCollections();
  const now = Date.now(),
    window = Math.floor(now / windowMs);
  const counters = database.collection<{
    _id: string;
    count: number;
    expiresAt: Date;
  }>("authRateLimits");
  const result = await counters.findOneAndUpdate(
    { _id: `${key}:${window}` },
    {
      $inc: { count: 1 },
      $setOnInsert: { expiresAt: new Date((window + 1) * windowMs) },
    },
    { upsert: true, returnDocument: "after" },
  );
  return Boolean(result && result.count <= limit);
}

// Initialize account storage without creating users or sending email.
// The previous two-slot restriction is superseded by public admin signup.
let storageInitialization: Promise<void> | undefined;
export async function ensureAccountStorage() {
  storageInitialization ??= (async () => {
    const { database, users } = await accountCollections();
    const validator = {
      $jsonSchema: {
        bsonType: "object",
        required: [
          "weddingId",
          "name",
          "email",
          "emailNormalized",
          "role",
          "status",
          "sessionVersion",
        ],
        properties: {
          weddingId: { bsonType: "objectId" },
          role: { enum: ["admin", "organizer"] },
          status: {
            enum: ["invited", "pending_verification", "active", "revoked"],
          },
          sessionVersion: { bsonType: ["int", "long", "double"], minimum: 1 },
        },
      },
    };
    const existing = await database.listCollections({ name: "users" }).next();
    if (!existing) {
      try {
        await database.createCollection("users", { validator });
      } catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === 48))
          throw error;
      }
    }
    if (
      existing &&
      "options" in existing &&
      existing.options?.validator &&
      JSON.stringify(existing.options.validator).includes('"adminSlot"')
    )
      await database.command({ collMod: "users", validator });
    for (const index of await users.listIndexes().toArray()) {
      if (
        index.name === "adminSlot_1" &&
        index.unique &&
        index.key.adminSlot === 1
      )
        await users.dropIndex(index.name);
    }
    await users.createIndex({ emailNormalized: 1 }, { unique: true });
    await database
      .collection("weddings")
      .createIndex({ singletonKey: 1 }, { unique: true });
    await database
      .collection("authRateLimits")
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  })().catch((error) => {
    storageInitialization = undefined;
    throw error;
  });
  return storageInitialization;
}
