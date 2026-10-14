import "server-only";
import { createHash } from "node:crypto";
import { ObjectId, type Document } from "mongodb";
import { getDatabase } from "@/server/db/mongodb";
import {
  ensureWeddingStorage,
  type WeddingRecord,
} from "@/features/wedding-onboarding/server/repository";
import type { CurrentStaff } from "@/server/auth/authorization";
import { eventSchedule } from "../schedule";
import {
  EVENT_PAGE_SIZE,
  type editEventSchema,
  type createEventSchema,
} from "../schemas";
import type { z } from "zod";
import { EventError } from "./error";
export type EventRecord = Document & {
  _id: ObjectId;
  weddingId: ObjectId;
  name: string;
  startsAt: Date;
  endsAt?: Date;
  venue: { name: string; address: string; instructions?: string };
  description?: string;
  lastEdit?: {
    clientRequestId: string;
    fingerprint: string;
    expectedRevision: number;
  };
  status: "active";
  clientRequestId: string;
  createFingerprint: string;
  revision: number;
};
const validator = {
  $jsonSchema: {
    bsonType: "object",
    required: ["weddingId", "name", "startsAt", "venue", "status", "revision"],
    properties: {
      weddingId: { bsonType: "objectId" },
      name: { bsonType: "string", minLength: 1, maxLength: 200 },
      startsAt: { bsonType: "date" },
      endsAt: { bsonType: "date" },
      venue: {
        bsonType: "object",
        required: ["name", "address"],
        properties: {
          name: { bsonType: "string", minLength: 1, maxLength: 200 },
          address: { bsonType: "string", minLength: 1, maxLength: 1000 },
          instructions: { bsonType: "string", maxLength: 1000 },
        },
      },
      description: { bsonType: "string", maxLength: 2000 },
      status: { enum: ["active", "cancelled", "archived"] },
      revision: {
        bsonType: ["int", "long", "double"],
        minimum: 1,
        multipleOf: 1,
      },
      clientRequestId: { bsonType: "string" },
      createFingerprint: { bsonType: "string" },
      createdAt: { bsonType: "date" },
      updatedAt: { bsonType: "date" },
      createdBy: { bsonType: "objectId" },
      updatedBy: { bsonType: "objectId" },
    },
  },
};
let storage: Promise<void> | undefined;
export function ensureEventStorage() {
  storage ??= (async () => {
    const db = await getDatabase();
    let collection = await db.listCollections({ name: "events" }).next();
    if (!collection) {
      try {
        await db.createCollection("events", { validator });
      } catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === 48))
          throw error;
      }
      collection = await db.listCollections({ name: "events" }).next();
    }
    const previous =
      collection && "options" in collection
        ? collection.options?.validator
        : undefined;
    if (
      !previous ||
      !JSON.stringify(previous).includes(JSON.stringify(validator))
    ) {
      await db.command({
        collMod: "events",
        validator:
          previous && Object.keys(previous).length
            ? { $and: [previous, validator] }
            : validator,
      });
    }
    await db
      .collection("events")
      .createIndex({ weddingId: 1, status: 1, startsAt: 1, _id: 1 });
    await db.collection("events").createIndex(
      { weddingId: 1, clientRequestId: 1 },
      {
        unique: true,
        partialFilterExpression: { clientRequestId: { $type: "string" } },
      },
    );
  })().catch((error) => {
    storage = undefined;
    throw error;
  });
  return storage;
}
export async function eventExists(weddingId: string) {
  return Boolean(
    await (
      await getDatabase()
    )
      .collection("events")
      .findOne(
        { weddingId: new ObjectId(weddingId) },
        { projection: { _id: 1 } },
      ),
  );
}
export async function listEventRecords(
  weddingId: string,
  q: string,
  page: number,
) {
  const escaped = q.replace(/[.*+?^\${}()|[\]\\]/g, "\\$&");
  return (await getDatabase())
    .collection<EventRecord>("events")
    .find({
      weddingId: new ObjectId(weddingId),
      status: "active",
      ...(q ? { name: { $regex: escaped, $options: "i" } } : {}),
    })
    .sort({ startsAt: 1, _id: 1 })
    .skip((page - 1) * EVENT_PAGE_SIZE)
    .limit(EVENT_PAGE_SIZE + 1)
    .toArray();
}
export async function insertEvent(
  staff: CurrentStaff,
  input: z.output<typeof createEventSchema>,
) {
  await ensureWeddingStorage();
  await ensureEventStorage();
  const db = await getDatabase(),
    weddingId = new ObjectId(staff.weddingId);
  const events = db.collection<EventRecord>("events");
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ actor: staff.id, values: input.values }))
    .digest("hex");
  const session = db.client.startSession();
  try {
    return await session.withTransaction(
      async () => {
        const existing = await events.findOne(
          { weddingId, clientRequestId: input.clientRequestId },
          { session },
        );
        if (existing) {
          if (existing.createFingerprint !== fingerprint)
            throw new EventError(
              "This request was already used for different details. Open the event list to check the saved event.",
              409,
              "REQUEST_REUSED",
            );
          return { id: existing._id.toHexString(), created: false };
        }
        const wedding = await db
          .collection<WeddingRecord>("weddings")
          .findOne(
            { _id: weddingId, singletonKey: "primary", status: "active" },
            { session },
          );
        if (!wedding?.onboarding?.completedAt || !wedding.timeZone)
          throw new EventError(
            "Finish wedding setup before adding events.",
            409,
            "SETUP_REQUIRED",
          );
        if (wedding.revision !== input.expectedWeddingRevision)
          throw new EventError(
            "Wedding settings changed. Load the latest settings, then check the displayed time zone before creating your event.",
            409,
            "WEDDING_CHANGED",
          );
        const schedule = eventSchedule(input.values, wedding.timeZone);
        if (Object.keys(schedule.fields).length || !schedule.startsAt)
          throw new EventError(
            "Please check the schedule.",
            400,
            "INVALID_INPUT",
            schedule.fields,
          );
        // Writing the same wedding revision as Settings serializes the zone lock
        // with insertion. A failed insert rolls this revision increment back.
        const lock = await db.collection("weddings").updateOne(
          {
            _id: weddingId,
            revision: input.expectedWeddingRevision,
            status: "active",
          },
          { $inc: { revision: 1 }, $set: { updatedAt: new Date() } },
          { session },
        );
        if (lock.matchedCount !== 1)
          throw new EventError(
            "Wedding settings changed. Load the latest settings before creating your event.",
            409,
            "WEDDING_CHANGED",
          );
        const now = new Date(),
          actor = new ObjectId(staff.id),
          id = new ObjectId(),
          v = input.values;
        await events.insertOne(
          {
            _id: id,
            weddingId,
            name: v.name,
            startsAt: schedule.startsAt,
            ...(schedule.endsAt ? { endsAt: schedule.endsAt } : {}),
            venue: {
              name: v.venueName,
              address: v.venueAddress,
              ...(v.instructions ? { instructions: v.instructions } : {}),
            },
            ...(v.description ? { description: v.description } : {}),
            status: "active",
            revision: 1,
            clientRequestId: input.clientRequestId,
            createFingerprint: fingerprint,
            createdAt: now,
            updatedAt: now,
            createdBy: actor,
            updatedBy: actor,
          },
          { session },
        );
        return { id: id.toHexString(), created: true };
      },
      {
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
        maxCommitTimeMS: 10000,
        timeoutMS: 30000,
      },
    );
  } finally {
    await session.endSession();
  }
}

export async function findEventRecord(weddingId: string, eventId: string) {
  return (await getDatabase()).collection<EventRecord>("events").findOne({
    _id: new ObjectId(eventId),
    weddingId: new ObjectId(weddingId),
    status: "active",
  });
}
export async function updateEventRecord(
  staff: CurrentStaff,
  eventId: string,
  input: z.output<typeof editEventSchema>,
  schedule: { startsAt: Date; endsAt: Date | null },
) {
  await ensureEventStorage();
  const db = await getDatabase(),
    scope = {
      _id: new ObjectId(eventId),
      weddingId: new ObjectId(staff.weddingId),
      status: "active" as const,
    };
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        actor: staff.id,
        expectedRevision: input.expectedRevision,
        values: input.values,
      }),
    )
    .digest("hex");
  function replay(record: EventRecord | null) {
    if (!record)
      throw new EventError("This event is unavailable.", 404, "NOT_FOUND");
    if (record.lastEdit?.clientRequestId === input.clientRequestId) {
      if (record.lastEdit.fingerprint !== fingerprint)
        throw new EventError(
          "This save request was already used for different details. Load the latest saved event before editing again.",
          409,
          "REQUEST_REUSED",
        );
      if (record.revision === input.expectedRevision + 1)
        return { id: eventId, revision: record.revision, replayed: true };
    }
    return null;
  }
  const before = await db.collection<EventRecord>("events").findOne(scope);
  const previous = replay(before);
  if (previous) return previous;
  if (before!.revision !== input.expectedRevision)
    throw new EventError(
      "Another staff member updated this event. Load the latest saved event before saving.",
      409,
      "EVENT_CHANGED",
    );
  const v = input.values;
  const set: Record<string, unknown> = {
    name: v.name,
    startsAt: schedule.startsAt,
    "venue.name": v.venueName,
    "venue.address": v.venueAddress,
    updatedAt: new Date(),
    updatedBy: new ObjectId(staff.id),
    lastEdit: {
      clientRequestId: input.clientRequestId,
      fingerprint,
      expectedRevision: input.expectedRevision,
    },
  };
  const unset: Record<string, ""> = {};
  if (schedule.endsAt) set.endsAt = schedule.endsAt;
  else unset.endsAt = "";
  if (v.description) set.description = v.description;
  else unset.description = "";
  if (v.instructions) set["venue.instructions"] = v.instructions;
  else unset["venue.instructions"] = "";
  // Only event-owned detail fields change. Attendance, photos, lifecycle and
  // the create request identity are deliberately outside this update.
  const updated = await db
    .collection<EventRecord>("events")
    .findOneAndUpdate(
      { ...scope, revision: input.expectedRevision },
      { $set: set, $unset: unset, $inc: { revision: 1 } },
      { returnDocument: "after" },
    );
  if (updated)
    return { id: eventId, revision: updated.revision, replayed: false };
  const concurrent = await db.collection<EventRecord>("events").findOne(scope);
  const retried = replay(concurrent);
  if (retried) return retried;
  throw new EventError(
    "Another staff member updated this event. Load the latest saved event before saving.",
    409,
    "EVENT_CHANGED",
  );
}
