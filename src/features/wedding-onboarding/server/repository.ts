import "server-only";
import { cache } from "react";
import { ObjectId, type Document, type UpdateFilter } from "mongodb";
import { getDatabase } from "@/server/db/mongodb";

export type WeddingRecord = Document & {
  _id: ObjectId;
  singletonKey: "primary";
  status: "setup" | "active" | "archived";
  revision: number;
  couple?: { partnerOneName: string; partnerTwoName: string };
  weddingDate?: string;
  timeZone?: string;
  currency?: string;
  currencyMinorUnit?: number;
  website?: { venue?: { name: string; address: string } };
  onboarding?: {
    step?: 1 | 2 | 3;
    dateUndecided?: boolean;
    venueUndecided?: boolean;
    completedAt?: Date;
  };
};
// Request-local render snapshot; never a persistent authorization/data cache.
export const findWedding = cache(async function readWedding(weddingId: string) {
  const db = await getDatabase();
  return db.collection<WeddingRecord>("weddings").findOne({
    _id: new ObjectId(weddingId),
    singletonKey: "primary",
    status: { $in: ["setup", "active"] },
  });
});
const validator = {
  $jsonSchema: {
    bsonType: "object",
    required: ["singletonKey", "status", "revision"],
    properties: {
      singletonKey: { enum: ["primary"] },
      status: { enum: ["setup", "active", "archived"] },
      revision: {
        bsonType: ["int", "long", "double"],
        minimum: 1,
        maximum: Number.MAX_SAFE_INTEGER,
        multipleOf: 1,
      },
      couple: {
        bsonType: "object",
        required: ["partnerOneName", "partnerTwoName"],
        properties: {
          partnerOneName: { bsonType: "string", minLength: 1, maxLength: 200 },
          partnerTwoName: { bsonType: "string", minLength: 1, maxLength: 200 },
        },
      },
      weddingDate: {
        bsonType: "string",
        pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$",
      },
      timeZone: { bsonType: "string", minLength: 1, maxLength: 100 },
      currency: { bsonType: "string", pattern: "^[A-Z]{3}$" },
      currencyMinorUnit: {
        bsonType: ["int", "long", "double"],
        minimum: 0,
        maximum: 4,
        multipleOf: 1,
      },
      website: {
        bsonType: "object",
        properties: {
          venue: {
            bsonType: "object",
            required: ["name", "address"],
            properties: {
              name: { bsonType: "string", maxLength: 200 },
              address: { bsonType: "string", maxLength: 1000 },
            },
          },
        },
      },
      onboarding: {
        bsonType: "object",
        properties: {
          step: { enum: [1, 2, 3] },
          dateUndecided: { bsonType: "bool" },
          venueUndecided: { bsonType: "bool" },
          completedAt: { bsonType: "date" },
        },
      },
    },
  },
};
let storage: Promise<void> | undefined;
export async function ensureWeddingStorage() {
  storage ??= (async () => {
    const db = await getDatabase();
    const collection = await db.listCollections({ name: "weddings" }).next();
    if (!collection) throw new Error("Wedding is unavailable.");
    const previous =
      "options" in collection ? collection.options?.validator : undefined;
    // Preserve an existing validator rather than weakening unrelated invariants.
    if (
      !previous ||
      !JSON.stringify(previous).includes(JSON.stringify(validator))
    ) {
      await db.command({
        collMod: "weddings",
        validator:
          previous && Object.keys(previous).length
            ? { $and: [previous, validator] }
            : validator,
      });
    }
    await db
      .collection("weddings")
      .createIndex({ singletonKey: 1 }, { unique: true });
  })().catch((error) => {
    storage = undefined;
    throw error;
  });
  return storage;
}
export async function updateWedding(
  weddingId: string,
  expectedRevision: number,
  update: UpdateFilter<WeddingRecord>,
) {
  await ensureWeddingStorage();
  const db = await getDatabase();
  return db.collection<WeddingRecord>("weddings").findOneAndUpdate(
    {
      _id: new ObjectId(weddingId),
      singletonKey: "primary",
      status: "setup",
      revision: expectedRevision,
      "onboarding.completedAt": { $exists: false },
    },
    update,
    { returnDocument: "after" },
  );
}
