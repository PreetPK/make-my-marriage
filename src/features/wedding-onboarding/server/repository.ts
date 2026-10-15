import "server-only";
import { cache } from "react";
import { ObjectId, type Document, type UpdateFilter } from "mongodb";
import { getDatabase } from "@/server/db/mongodb";

export type WeddingRecord = Document & {
  _id: ObjectId;
  singletonKey?: "primary";
  ownerUserId?: ObjectId;
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
    status: { $in: ["setup", "active"] },
  });
});
const validator = {
  $jsonSchema: {
    bsonType: "object",
    required: ["status", "revision"],
    properties: {
      singletonKey: { enum: ["primary"] },
      ownerUserId: { bsonType: "objectId" },
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
    let collection = await db.listCollections({ name: "weddings" }).next();
    if (!collection) {
      try {
        await db.createCollection("weddings", { validator });
      } catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === 48))
          throw error;
      }
      collection = await db.listCollections({ name: "weddings" }).next();
    }
    const previous =
      collection && "options" in collection
        ? collection.options?.validator
        : undefined;
    // Remove only the superseded singleton requirement, preserving other validators.
    const compatible = removeSingletonRequirement(previous ?? {});
    if (!JSON.stringify(compatible).includes(JSON.stringify(validator))) {
      await db.command({
        collMod: "weddings",
        validator: Object.keys(compatible).length
          ? { $and: [compatible, validator] }
          : validator,
      });
    }
    const weddings = db.collection("weddings");
    const oldIndex = (await weddings.listIndexes().toArray()).find(
      (index) => index.name === "singletonKey_1",
    );
    if (oldIndex && !oldIndex.partialFilterExpression)
      await weddings.dropIndex("singletonKey_1");
    // Preserve uniqueness for legacy primary records; independent weddings omit this key.
    await weddings.createIndex(
      { singletonKey: 1 },
      {
        unique: true,
        partialFilterExpression: { singletonKey: { $type: "string" } },
      },
    );
    await weddings.createIndex(
      { ownerUserId: 1 },
      {
        unique: true,
        partialFilterExpression: { ownerUserId: { $type: "objectId" } },
      },
    );
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
      status: "setup",
      revision: expectedRevision,
      "onboarding.completedAt": { $exists: false },
    },
    update,
    { returnDocument: "after" },
  );
}

export function removeSingletonRequirement(
  value: unknown,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === "required" && Array.isArray(child))
      result[key] = child.filter((item) => item !== "singletonKey");
    else if (Array.isArray(child))
      result[key] = child.map((item) =>
        typeof item === "object" && item
          ? removeSingletonRequirement(item)
          : item,
      );
    else if (child && typeof child === "object")
      result[key] = removeSingletonRequirement(child);
    else result[key] = child;
  }
  return result;
}
