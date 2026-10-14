import assert from "node:assert/strict";
import { EVENT_REQUEST_BODY_LIMIT } from "../src/features/events/schemas.ts";
import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";
export async function runEventEditChecks({
  request,
  jar,
  db,
  origin,
  checkRedirect,
  eventId,
  foreignId,
}) {
  const path = "/api/events/" + eventId,
    page = "/events/" + eventId + "/edit",
    events = db.collection("events");
  const get = () => request(path, { jar });
  const patch = (body, options = {}) =>
    request(path, {
      jar,
      method: "PATCH",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify(body),
      ...options,
    });
  const detail = async () => (await (await get()).json()).event;
  let event = await detail();
  const body = (values = event.values) => ({
    clientRequestId: randomUUID(),
    expectedRevision: event.revision,
    values,
  });
  assert.equal(event.values.endDate, "20/02/2027");
  assert.equal((await request(path)).status, 401);
  checkRedirect(await request(page), "/login");
  assert.equal((await request(page, { jar })).status, 200);
  assert.equal((await patch(body(), { jar: undefined })).status, 401);
  assert.equal(
    (
      await patch(body(), {
        headers: {
          "content-type": "application/json",
          origin: "https://attacker.example",
        },
      })
    ).status,
    403,
  );
  assert.equal(
    (await patch(body(), { headers: { "content-type": "text/plain", origin } }))
      .status,
    415,
  );
  assert.equal((await patch(body(), { body: "{" })).status, 400);
  assert.equal(
    (await patch(body(), { body: "x".repeat(EVENT_REQUEST_BODY_LIMIT + 1) }))
      .status,
    413,
  );
  for (const extra of [
    { weddingId: "other" },
    { role: "admin" },
    { status: "archived" },
    { visibility: "wedding_link" },
    { expectedRevision: 0 },
    { values: { ...event.values, name: { $ne: null } } },
    { values: { ...event.values, rsvp: { autoReminderEnabled: true } } },
    { values: { ...event.values, gallery: { acceptUploads: true } } },
  ])
    assert.equal((await patch({ ...body(), ...extra })).status, 400);
  assert.equal((await request("/api/events/bad-id", { jar })).status, 400);
  assert.equal(
    (await request("/api/events/" + new ObjectId(), { jar })).status,
    404,
  );
  assert.equal(
    (await request("/api/events/" + foreignId, { jar })).status,
    404,
  );
  assert.equal(
    (
      await request("/api/events/" + foreignId, {
        jar,
        method: "PATCH",
        headers: { "content-type": "application/json", origin },
        body: JSON.stringify(body()),
      })
    ).status,
    404,
  );
  assert.equal(
    (await request("/events/" + foreignId + "/edit", { jar })).status,
    404,
  );
  const before = await events.findOne({ _id: new ObjectId(eventId) }),
    other = await events.findOne({ _id: new ObjectId(foreignId) });
  await events.updateOne(
    { _id: before._id },
    {
      $set: {
        rsvp: { test: "keep" },
        gallery: { test: "keep" },
        visibility: "invited_only",
        "venue.extra": "keep",
      },
    },
  );
  await db.collection("eventInvitations").insertOne({
    eventId: before._id,
    weddingId: before.weddingId,
    test: "keep",
  });
  const update = body({
    ...event.values,
    name: "Edited ceremony",
    date: "20/02/2027",
    startTime: "18:00",
    endDate: "21/02/2027",
    endTime: "01:00",
    venueName: "Rosewood Hall",
    venueAddress: "42 Garden Lane",
    instructions: "Side entrance",
  });
  const repeated = await Promise.all([patch(update), patch(update)]);
  assert.deepEqual(
    repeated.map((r) => r.status),
    [200, 200],
  );
  assert.equal((await detail()).revision, event.revision + 1);
  assert.equal((await patch(update)).status, 200);
  assert.equal(
    (
      await patch({
        ...update,
        values: { ...update.values, name: "Reuse changed" },
      })
    ).status,
    409,
  );
  assert.equal(
    (await patch({ ...update, clientRequestId: randomUUID() })).status,
    409,
  );
  let stored = await events.findOne({ _id: before._id });
  assert.equal(stored.startsAt.toISOString(), "2027-02-20T07:00:00.000Z");
  assert.equal(stored.endsAt.toISOString(), "2027-02-20T14:00:00.000Z");
  assert.equal(stored.clientRequestId, before.clientRequestId);
  assert.equal(stored.createFingerprint, before.createFingerprint);
  assert.equal(stored.createdBy.toString(), before.createdBy.toString());
  assert.deepEqual(stored.createdAt, before.createdAt);
  assert.deepEqual(stored.rsvp, { test: "keep" });
  assert.deepEqual(stored.gallery, { test: "keep" });
  assert.equal(stored.venue.extra, "keep");
  assert.equal(
    await db
      .collection("eventInvitations")
      .countDocuments({ eventId: before._id }),
    1,
  );
  assert.deepEqual(await events.findOne({ _id: other._id }), other);
  event = await detail();
  const concurrent = await Promise.all([
    patch(body({ ...event.values, name: "Staff A" })),
    patch(body({ ...event.values, name: "Staff B" })),
  ]);
  assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 409]);
  event = await detail();
  assert.equal(
    (
      await patch(
        body({
          ...event.values,
          date: "04/10/2026",
          startTime: "02:30",
          endDate: "",
          endTime: "",
        }),
      )
    ).status,
    400,
  );
  const options = await db.listCollections({ name: "events" }).next(),
    validator = options.options.validator,
    fail = body({ ...event.values, name: "Reject edit" });
  try {
    await db.command({
      collMod: "events",
      validator: { $and: [validator, { name: { $ne: "Reject edit" } }] },
    });
    assert.equal((await patch(fail)).status, 503);
    assert.equal((await detail()).revision, event.revision);
  } finally {
    await db.command({ collMod: "events", validator });
  }
  assert.equal((await patch(fail)).status, 200);
  assert.equal((await patch(fail)).status, 200);
  event = await detail();
  const admin = await db
    .collection("users")
    .findOne({ emailNormalized: "http-admin@example.invalid" });
  await db
    .collection("users")
    .updateOne({ _id: admin._id }, { $set: { role: "organizer" } });
  try {
    assert.equal((await get()).status, 200);
    assert.equal(
      (
        await patch(
          body({
            ...event.values,
            name: "Organizer edit",
            description: "",
            instructions: "",
            endDate: "",
            endTime: "",
          }),
        )
      ).status,
      200,
    );
  } finally {
    await db
      .collection("users")
      .updateOne({ _id: admin._id }, { $set: { role: "admin" } });
  }
  stored = await events.findOne({ _id: before._id });
  assert.equal(stored.endsAt, undefined);
  assert.equal(stored.description, undefined);
  assert.equal(stored.venue.instructions, undefined);
  assert.equal(stored.venue.extra, "keep");
  for (const change of [
    { status: "revoked" },
    { sessionVersion: admin.sessionVersion + 1 },
  ]) {
    await db
      .collection("users")
      .updateOne({ _id: admin._id }, { $set: change });
    try {
      assert.equal((await get()).status, 401);
      assert.equal((await patch(body())).status, 401);
      checkRedirect(await request(page, { jar }), "/login");
    } finally {
      await db.collection("users").updateOne(
        { _id: admin._id },
        {
          $set: {
            status: admin.status,
            sessionVersion: admin.sessionVersion,
          },
        },
      );
    }
  }
  assert.equal(
    (
      await request(path, {
        headers: { cookie: "next-auth.session-token=forged" },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request(path, {
        headers: {
          authorization: "Bearer " + jar.values.get("next-auth.session-token"),
        },
      })
    ).status,
    401,
  );
  assert.match((await get()).headers.get("cache-control"), /no-store/);
  await events.updateOne({ _id: before._id }, { $set: { status: "archived" } });
  try {
    assert.equal((await get()).status, 404);
    assert.equal((await patch(body())).status, 404);
  } finally {
    await events.updateOne({ _id: before._id }, { $set: { status: "active" } });
  }
  console.log(
    "PASS event editing persistence, optional clearing, scope/status/session protections, concurrent revisions, repeat retries, validator failures and preserved associations",
  );
}
