import assert from "node:assert/strict";
import { EVENT_REQUEST_BODY_LIMIT } from "../src/features/events/schemas.ts";
import { runEventBodyChecks } from "./events-body.http.mjs";
import { runEventEditChecks } from "./events-edit.http.mjs";
import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";
export async function runEventChecks({
  request,
  jar,
  db,
  origin,
  checkRedirect,
}) {
  const api = "/api/events",
    events = db.collection("events"),
    weddings = db.collection("weddings");
  const get = (query = "") => request(api + query, { jar });
  const post = (body, options = {}) =>
    request(api, {
      jar,
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify(body),
      ...options,
    });
  const context = async () => (await (await get("?context=1")).json()).context;
  const values = {
    name: "Ceremony [garden]",
    description: "Test celebration",
    date: "19/02/2027",
    startTime: "14:00",
    endDate: "20/02/2027",
    endTime: "01:00",
    venueName: "Garden Pavilion",
    venueAddress: "18 Garden Lane",
    instructions: "Use the garden entrance",
  };
  const input = async (v = values) => ({
    clientRequestId: randomUUID(),
    expectedWeddingRevision: (await context()).weddingRevision,
    values: v,
  });
  assert.equal((await request(api)).status, 401);
  checkRedirect(await request("/events"), "/login");
  checkRedirect(await request("/events/new"), "/login");
  assert.equal((await request("/events", { jar })).status, 200);
  assert.equal((await request("/events/new", { jar })).status, 200);
  assert.equal((await post(await input(), { jar: undefined })).status, 401);
  assert.equal(
    (
      await post(await input(), {
        headers: {
          "content-type": "application/json",
          origin: "https://attacker.example",
        },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await post(await input(), {
        headers: { "content-type": "text/plain", origin },
      })
    ).status,
    415,
  );
  assert.equal((await post(await input(), { body: "{" })).status, 400);
  assert.equal(
    (
      await post(await input(), {
        body: "x".repeat(EVENT_REQUEST_BODY_LIMIT + 1),
      })
    ).status,
    413,
  );
  for (const extra of [
    { weddingId: "other" },
    { role: "admin" },
    { visibility: "wedding_link" },
    { status: "archived" },
    { expectedWeddingRevision: 0 },
    { values: { ...values, name: { $ne: null } } },
    { values: { ...values, name: "" } },
    { values: { ...values, startTime: "25:00" } },
  ])
    assert.equal((await post({ ...(await input()), ...extra })).status, 400);
  const wedding = await weddings.findOne({ singletonKey: "primary" }),
    before = JSON.stringify(wedding.website);
  const firstBody = await input();
  const results = await Promise.all([post(firstBody), post(firstBody)]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 201]);
  const ids = await Promise.all(results.map((r) => r.json()));
  assert.equal(ids[0].id, ids[1].id);
  assert.equal(
    await events.countDocuments({ clientRequestId: firstBody.clientRequestId }),
    1,
  );
  let record = await events.findOne({
    clientRequestId: firstBody.clientRequestId,
  });
  assert.equal(record.startsAt.toISOString(), "2027-02-19T03:00:00.000Z");
  assert.equal(record.endsAt.toISOString(), "2027-02-19T14:00:00.000Z");
  assert.equal(record.venue.instructions, values.instructions);
  assert.equal(record.weddingId.toString(), wedding._id.toString());
  assert.equal(record.visibility, undefined);
  assert.equal(record.rsvp, undefined);
  assert.equal(
    JSON.stringify((await weddings.findOne({ _id: wedding._id })).website),
    before,
  );
  assert.equal(
    (await post({ ...firstBody, values: { ...values, name: "Changed" } }))
      .status,
    409,
  );
  const stale = await post({ ...firstBody, clientRequestId: randomUUID() });
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).code, "WEDDING_CHANGED");
  for (const [date, startTime] of [
    ["04/10/2026", "02:30"],
    ["05/04/2026", "02:30"],
  ])
    assert.equal(
      (
        await post(
          await input({ ...values, date, startTime, endDate: "", endTime: "" }),
        )
      ).status,
      400,
    );
  assert.equal(
    (await post(await input({ ...values, endDate: "", endTime: "01:00" })))
      .status,
    400,
  );
  const settings = await (
    await request("/api/wedding/settings", { jar })
  ).json();
  assert.equal(settings.state.locks.timeZone, true);
  const settingInput = {
    expectedRevision: settings.state.revision,
    values: {
      couple: {
        brideName: settings.state.values.brideName,
        groomName: settings.state.values.groomName,
        weddingDate: settings.state.values.weddingDate,
        dateUndecided: settings.state.values.dateUndecided,
      },
      venue: {
        venueName: settings.state.values.venueName,
        venueAddress: settings.state.values.venueAddress,
        venueUndecided: settings.state.values.venueUndecided,
      },
      preferences: {
        timeZone: "UTC",
        currency: settings.state.values.currency,
      },
    },
  };
  assert.equal(
    (
      await request("/api/wedding/settings", {
        jar,
        method: "PATCH",
        headers: { "content-type": "application/json", origin },
        body: JSON.stringify(settingInput),
      })
    ).status,
    409,
  );
  const admin = await db
    .collection("users")
    .findOne({ emailNormalized: "http-admin@example.invalid" });
  await db
    .collection("users")
    .updateOne({ _id: admin._id }, { $set: { role: "organizer" } });
  try {
    assert.equal((await get()).status, 200);
    assert.equal(
      (await post(await input({ ...values, name: "Organizer event" }))).status,
      201,
    );
    assert.equal((await request("/api/wedding/settings", { jar })).status, 403);
  } finally {
    await db
      .collection("users")
      .updateOne({ _id: admin._id }, { $set: { role: "admin" } });
  }
  // Literal regex metacharacters must not act as patterns or leak another scope.
  const foreign = {
    ...record,
    _id: new ObjectId(),
    weddingId: new ObjectId(),
    clientRequestId: randomUUID(),
    name: "Foreign wedding",
  };
  await events.insertOne(foreign);
  let state = (await (await get("?q=" + encodeURIComponent("[garden]"))).json())
    .state;
  assert.equal(state.events.length, 1);
  assert.equal(state.events[0].id, record._id.toString());
  assert.equal((await get("?q=" + encodeURIComponent(".*"))).status, 200);
  assert.equal(
    (await (await get("?q=" + encodeURIComponent(".*"))).json()).state.events
      .length,
    0,
  );
  assert.equal((await get("?page=0")).status, 400);
  assert.equal((await get("?role=admin")).status, 400);
  const batch = Array.from({ length: 22 }, (_, i) => ({
    ...record,
    _id: new ObjectId(),
    clientRequestId: randomUUID(),
    name: "Page event " + String(i).padStart(2, "0"),
  }));
  await events.insertMany(batch);
  const p1 = (await (await get()).json()).state,
    p2 = (await (await get("?page=2")).json()).state;
  assert.equal(p1.events.length, 20);
  assert.equal(p1.hasNext, true);
  assert.equal(p2.events.length, 4);
  assert.equal(new Set([...p1.events, ...p2.events].map((e) => e.id)).size, 24);
  assert(!p1.events.some((e) => e.name === "Foreign wedding"));
  assert.match((await get()).headers.get("cache-control"), /no-store/);
  await runEventEditChecks({
    request,
    jar,
    db,
    origin,
    checkRedirect,
    eventId: record._id.toString(),
    foreignId: foreign._id.toString(),
  });
  // A validator failure must roll back the wedding lock revision and insertion.
  const options = await db.listCollections({ name: "events" }).next(),
    validator = options.options.validator,
    failBody = await input({ ...values, name: "Reject Test" });
  try {
    await db.command({
      collMod: "events",
      validator: { $and: [validator, { name: { $ne: "Reject Test" } }] },
    });
    assert.equal((await post(failBody)).status, 503);
    assert.equal(
      (await context()).weddingRevision,
      failBody.expectedWeddingRevision,
    );
    assert.equal(
      await events.countDocuments({
        clientRequestId: failBody.clientRequestId,
      }),
      0,
    );
  } finally {
    await db.command({ collMod: "events", validator });
  }
  assert.equal((await post(failBody)).status, 201);
  assert.equal((await post(failBody)).status, 200);
  // Concurrent first-event insertion and time-zone edit must have only one winner.
  await events.deleteMany({});
  const raceState = (
    await (await request("/api/wedding/settings", { jar })).json()
  ).state;
  const raceCreate = await input({ ...values, name: "Race event" });
  settingInput.expectedRevision = raceState.revision;
  const raced = await Promise.all([
    post(raceCreate),
    request("/api/wedding/settings", {
      jar,
      method: "PATCH",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify(settingInput),
    }),
  ]);
  assert.equal(raced.filter((r) => r.ok).length, 1);
  assert.equal(raced.filter((r) => r.status === 409).length, 1);
  const current = await weddings.findOne({ _id: wedding._id });
  const created = await events.findOne({
    clientRequestId: raceCreate.clientRequestId,
  });
  if (created) {
    assert.equal(current.timeZone, "Australia/Melbourne");
    assert.equal(created.startsAt.toISOString(), "2027-02-19T03:00:00.000Z");
  } else {
    assert.equal(current.timeZone, "UTC");
  }
  // Keep the fixture suitable for later performance/browser checks.
  await events.deleteMany({});
  await weddings.updateOne(
    { _id: wedding._id },
    { $set: { timeZone: "Australia/Melbourne" }, $inc: { revision: 1 } },
  );
  await runEventBodyChecks({ request, jar, db, origin });
  console.log(
    "PASS events permissions, transport, zone/DST/overnight conversion, duplicate retries, literal search/pagination, rollback, and first-event/settings race",
  );
}
