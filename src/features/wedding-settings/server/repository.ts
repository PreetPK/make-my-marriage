import "server-only";
import { ObjectId, type UpdateFilter } from "mongodb";
import { WeddingSettingsError } from "./error";
import { getDatabase } from "@/server/db/mongodb";
import {
  ensureWeddingStorage,
  type WeddingRecord,
} from "@/features/wedding-onboarding/server/repository";
export async function preferenceLocks(weddingId: string) {
  const db = await getDatabase();
  const scope = { weddingId: new ObjectId(weddingId) };
  const [event, expense] = await Promise.all([
    db.collection("events").findOne(scope, { projection: { _id: 1 } }),
    db.collection("expenses").findOne(scope, { projection: { _id: 1 } }),
  ]);
  return { timeZone: Boolean(event), currency: Boolean(expense) };
}
export async function updateSettings(
  weddingId: string,
  expectedRevision: number,
  update: UpdateFilter<WeddingRecord>,
) {
  await ensureWeddingStorage();
  const db = await getDatabase();
  const session = db.client.startSession();
  try {
    return await session.withTransaction(
      async () => {
        const scope = {
          _id: new ObjectId(weddingId),
          singletonKey: "primary" as const,
          status: "active" as const,
          revision: expectedRevision,
        };
        const wedding = await db
          .collection<WeddingRecord>("weddings")
          .findOne(scope, { session });
        if (!wedding) return null;
        // Read locks in the same transaction snapshot as the wedding revision.
        // Event creation writes this wedding too, so concurrent changes conflict.
        const related = { weddingId: new ObjectId(weddingId) };
        if (
          update.$set?.timeZone !== wedding.timeZone &&
          (await db
            .collection("events")
            .findOne(related, { session, projection: { _id: 1 } }))
        )
          throw new WeddingSettingsError(
            "The wedding time zone cannot change after events have been added.",
            409,
            "PREFERENCE_LOCKED",
            { timeZone: "Events already use this time zone." },
          );
        if (
          update.$set?.currency !== wedding.currency &&
          (await db
            .collection("expenses")
            .findOne(related, { session, projection: { _id: 1 } }))
        )
          throw new WeddingSettingsError(
            "The wedding currency cannot change after expenses have been added.",
            409,
            "PREFERENCE_LOCKED",
            { currency: "Expenses already use this currency." },
          );
        return db
          .collection<WeddingRecord>("weddings")
          .findOneAndUpdate(scope, update, {
            session,
            returnDocument: "after",
          });
      },
      {
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
        timeoutMS: 30000,
        maxCommitTimeMS: 10000,
      },
    );
  } finally {
    await session.endSession();
  }
}
