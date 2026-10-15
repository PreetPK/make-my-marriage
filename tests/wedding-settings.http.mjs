import assert from "node:assert/strict";
export async function runWeddingSettingsChecks({
  request,
  jar,
  db,
  origin,
  checkRedirect,
}) {
  const path = "/api/wedding/settings";
  const weddings = db.collection("weddings");
  const get = (options = {}) => request(path, { jar, ...options });
  const write = (body, options = {}) =>
    request(path, {
      jar,
      method: "PATCH",
      headers: { "Content-Type": "application/json", origin },
      body: JSON.stringify(body),
      ...options,
    });
  assert.equal((await get({ jar: undefined })).status, 401);
  assert.equal((await request("/wedding-settings", { jar })).status, 200);
  checkRedirect(await request("/wedding-settings"), "/login");
  let state = (await (await get()).json()).state;
  let record = await weddings.findOne({ status: "active" });
  const identity = record._id;
  const completion = record.onboarding.completedAt;
  const values = {
    couple: {
      brideName: "Asha",
      groomName: "Dev",
      weddingDate: "29/02/2028",
      dateUndecided: false,
    },
    venue: {
      venueName: "Willow Hall",
      venueAddress: "18 Garden Lane",
      venueUndecided: false,
    },
    preferences: { timeZone: "Australia/Melbourne", currency: "AUD" },
  };
  const input = () => ({ expectedRevision: state.revision, values });
  assert.equal((await write(input(), { jar: undefined })).status, 401);
  assert.equal(
    (
      await write(input(), {
        headers: {
          "Content-Type": "application/json",
          origin: "https://attacker.example",
        },
      })
    ).status,
    403,
  );
  assert.equal(
    (await write(input(), { headers: { "Content-Type": "application/json" } }))
      .status,
    403,
  );
  assert.equal(
    (
      await write(input(), {
        headers: { "Content-Type": "text/plain", origin },
      })
    ).status,
    415,
  );
  assert.equal((await write(input(), { body: "{" })).status, 400);
  assert.equal((await write(input(), { body: "x".repeat(8193) })).status, 413);
  for (const extra of [
    { weddingId: "other" },
    { role: "admin" },
    { published: true },
    { expectedRevision: 0 },
    {
      values: {
        ...values,
        couple: { ...values.couple, brideName: { $ne: null } },
      },
    },
  ])
    assert.equal((await write({ ...input(), ...extra })).status, 400);
  const first = await write(input());
  assert.equal(first.status, 200);
  assert.match(first.headers.get("cache-control"), /no-store/);
  state = (await first.json()).state;
  record = await weddings.findOne({ _id: identity });
  assert.equal(record.weddingDate, "2028-02-29");
  assert.equal(record.timeZone, "Australia/Melbourne");
  assert.equal(record.currency, "AUD");
  assert.equal(record.currencyMinorUnit, 2);
  assert.equal(record.status, "active");
  assert.deepEqual(record.onboarding.completedAt, completion);
  assert.equal(record.website?.published, undefined);
  await weddings.updateOne(
    { _id: identity },
    {
      $set: {
        "website.story": "Keep this story",
        "website.venue.instructions": "Keep these instructions",
        "couple.extra": "Keep this value",
      },
    },
  );
  const stale = input();
  const outcomes = await Promise.all([
    write(input()),
    write({
      ...input(),
      values: { ...values, couple: { ...values.couple, brideName: "Mira" } },
    }),
  ]);
  assert.deepEqual(outcomes.map((r) => r.status).sort(), [200, 409]);
  assert.equal((await write(stale)).status, 409);
  state = (await (await get()).json()).state;
  const admin = await db
    .collection("users")
    .findOne({ emailNormalized: "http-admin@example.invalid" });
  await db
    .collection("users")
    .updateOne({ _id: admin._id }, { $set: { role: "organizer" } });
  assert.equal((await get()).status, 403);
  assert.equal((await write(input())).status, 403);
  checkRedirect(await request("/wedding-settings", { jar }), "/dashboard");
  await db
    .collection("users")
    .updateOne({ _id: admin._id }, { $set: { role: "admin" } });
  await db.collection("events").insertOne({ weddingId: identity });
  await db.collection("expenses").insertOne({ weddingId: identity });
  state = (await (await get()).json()).state;
  assert.deepEqual(state.locks, { timeZone: true, currency: true });
  assert.equal(
    (
      await write({
        ...input(),
        values: {
          ...values,
          preferences: { ...values.preferences, timeZone: "UTC" },
        },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await write({
        ...input(),
        values: {
          ...values,
          preferences: { ...values.preferences, currency: "JPY" },
        },
      })
    ).status,
    409,
  );
  const namesOnly = await write(input());
  assert.equal(namesOnly.status, 200);
  state = (await namesOnly.json()).state;
  await db.collection("events").deleteMany({ weddingId: identity });
  await db.collection("expenses").deleteMany({ weddingId: identity });
  // An actual storage rejection must leave all settings and revision unchanged.
  const options = await db.listCollections({ name: "weddings" }).next();
  const validator = options.options.validator;
  try {
    await db.command({
      collMod: "weddings",
      validator: {
        $and: [validator, { "couple.partnerOneName": { $ne: "Reject Test" } }],
      },
    });
    const response = await write({
      ...input(),
      values: {
        ...values,
        couple: { ...values.couple, brideName: "Reject Test" },
      },
    });
    assert.equal(response.status, 503);
    assert.equal(
      (await weddings.findOne({ _id: identity })).revision,
      state.revision,
    );
  } finally {
    await db.command({ collMod: "weddings", validator });
  }
  const retry = await write({
    ...input(),
    values: {
      ...values,
      couple: { ...values.couple, weddingDate: "", dateUndecided: true },
      venue: { ...values.venue, venueUndecided: true },
    },
  });
  assert.equal(retry.status, 200);
  record = await weddings.findOne({ _id: identity });
  assert.equal(record.weddingDate, undefined);
  assert.equal(record.website.venue.name, "");
  assert.equal(record.website.venue.instructions, "Keep these instructions");
  assert.equal(record.website.story, "Keep this story");
  assert.equal(record.couple.extra, "Keep this value");
  assert.deepEqual(record.onboarding.completedAt, completion);
  assert.equal(await weddings.countDocuments(), 2);
  assert.match((await get()).headers.get("cache-control"), /no-store/);
  assert(
    (await (await request("/dashboard", { jar })).text()).includes("Asha"),
  );
  console.log(
    "PASS wedding settings access/transport, persistence, conflicts, preference locks, non-destructive optional clearing, failed save/retry, and no publication",
  );
}
