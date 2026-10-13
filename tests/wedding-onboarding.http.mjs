import assert from "node:assert/strict";

// Runs inside the existing production-server fixture and disposable Atlas DB.
export async function runOnboardingChecks({
  request,
  signup,
  login,
  BrowserCookies,
  jar,
  db,
  checkRedirect,
  origin,
}) {
  const path = "/api/wedding/onboarding";
  const collection = db.collection("weddings");
  const initial = await collection.findOne({ singletonKey: "primary" });
  const couple = {
    brideName: "Asha",
    groomName: "Dev",
    weddingDate: "29/02/2028",
    dateUndecided: false,
  };
  const settings = { timeZone: "Asia/Kolkata", currency: "INR" };
  const venue = {
    venueName: "Willow Hall",
    venueAddress: "18 Garden Lane",
    venueUndecided: false,
  };
  const write = (body, extra = {}) =>
    request(path, {
      jar,
      method: "PATCH",
      headers: { "Content-Type": "application/json", origin },
      body: JSON.stringify(body),
      ...extra,
    });
  const one = { step: 1, expectedRevision: initial.revision, values: couple };
  checkRedirect(await request("/dashboard", { jar }), "/onboarding");
  assert.equal((await request("/onboarding", { jar })).status, 200);
  assert.equal((await write(one, { jar: undefined })).status, 401);
  assert.equal(
    (
      await write(one, {
        headers: {
          "Content-Type": "application/json",
          origin: "https://attacker.example",
        },
      })
    ).status,
    403,
  );
  assert.equal(
    (await write(one, { headers: { "Content-Type": "application/json" } }))
      .status,
    403,
  );
  assert.equal(
    (await write(one, { headers: { "Content-Type": "text/plain", origin } }))
      .status,
    415,
  );
  assert.equal((await write(one, { body: "{" })).status, 400);
  assert.equal((await write(one, { body: "x".repeat(8193) })).status, 413);
  assert.equal((await request(path)).status, 405);
  for (const extra of [
    { expectedRevision: 0 },
    { expectedRevision: 1.5 },
    { weddingId: "other" },
    { role: "admin" },
    { status: "active" },
    { values: { ...couple, brideName: { $ne: null } } },
    { values: { ...couple, weddingDate: "31/02/2027" } },
  ])
    assert.equal((await write({ ...one, ...extra })).status, 400);
  assert.equal(
    (
      await write({
        step: 3,
        expectedRevision: initial.revision,
        values: venue,
      })
    ).status,
    400,
  );
  assert.equal(
    (await collection.findOne({ _id: initial._id })).revision,
    initial.revision,
  );

  const email = "other-admin@example.invalid";
  const password = "Test correct horse battery staple";
  assert.equal(
    (
      await signup({
        name: "Other Test Admin",
        email,
        password,
        confirmPassword: password,
      })
    ).status,
    201,
  );
  const otherJar = new BrowserCookies();
  assert.equal((await login(otherJar, email)).status, 200);
  const outcomes = await Promise.all([
    write(one),
    write(
      { ...one, values: { ...couple, brideName: "Mira" } },
      { jar: otherJar },
    ),
  ]);
  assert.deepEqual(outcomes.map((r) => r.status).sort(), [200, 409]);
  let record = await collection.findOne({ _id: initial._id });
  assert.equal(record.revision, initial.revision + 1);
  assert.equal(record.weddingDate, "2028-02-29");
  assert.equal(record.onboarding.step, 2);
  assert.equal(record.status, "setup");
  const resumed = await (
    await request("/onboarding", { jar: otherJar })
  ).text();
  assert(resumed.includes('id="setup-timeZone"'));
  assert.equal((await write(one)).status, 409);
  const second = {
    step: 2,
    expectedRevision: record.revision,
    values: settings,
  };
  for (const values of [
    { timeZone: "", currency: "INR" },
    { timeZone: "invalid/zone", currency: "INR" },
    { timeZone: "UTC", currency: "ZZZ" },
    { timeZone: "UTC", currency: "inr" },
  ])
    assert.equal((await write({ ...second, values })).status, 400);
  const staff = await db
    .collection("users")
    .findOne({ emailNormalized: email });
  await db
    .collection("users")
    .updateOne({ _id: staff._id }, { $set: { role: "organizer" } });
  assert.equal((await write(second, { jar: otherJar })).status, 403);
  checkRedirect(await request("/onboarding", { jar: otherJar }), "/dashboard");
  await db
    .collection("users")
    .updateOne({ _id: staff._id }, { $set: { role: "admin" } });
  const saved = await write(second);
  assert.equal(saved.status, 200);
  assert.match(saved.headers.get("cache-control"), /no-store/);
  record = await collection.findOne({ _id: initial._id });
  assert.equal(record.currency, "INR");
  assert.equal(record.currencyMinorUnit, 2);
  assert.equal(record.timeZone, "Asia/Kolkata");
  assert.equal(record.onboarding.step, 3);
  for (const [currency, minor] of [
    ["JPY", 0],
    ["KWD", 3],
    ["INR", 2],
  ]) {
    assert.equal(
      (
        await write({
          step: 2,
          expectedRevision: record.revision,
          values: { ...settings, currency },
        })
      ).status,
      200,
    );
    record = await collection.findOne({ _id: initial._id });
    assert.equal(record.currencyMinorUnit, minor);
  }
  assert.equal(
    (
      await write({
        step: 1,
        expectedRevision: record.revision,
        values: { ...couple, weddingDate: "invalid", dateUndecided: true },
      })
    ).status,
    200,
  );
  record = await collection.findOne({ _id: initial._id });
  assert.equal(record.weddingDate, undefined);
  assert.equal(record.onboarding.dateUndecided, true);
  assert.equal(
    (
      await write({
        step: 2,
        expectedRevision: record.revision,
        values: settings,
      })
    ).status,
    200,
  );
  record = await collection.findOne({ _id: initial._id });
  await assert.rejects(
    collection.updateOne(
      { _id: initial._id },
      { $set: { couple: { partnerOneName: 123, partnerTwoName: "Dev" } } },
    ),
    (error) => error.code === 121,
  );
  const finish = {
    step: 3,
    expectedRevision: record.revision,
    values: { venueName: "", venueAddress: "", venueUndecided: false },
  };
  const completed = await Promise.all([
    write(finish),
    write({ ...finish, values: venue }, { jar: otherJar }),
  ]);
  assert.deepEqual(completed.map((r) => r.status).sort(), [200, 409]);
  const winner = await completed.find((r) => r.status === 200).json();
  assert.equal(winner.state.complete, true);
  record = await collection.findOne({ _id: initial._id });
  assert.equal(record.status, "active");
  assert(record.onboarding.completedAt instanceof Date);
  assert.equal(record.website?.published, undefined);
  assert.equal(record.publishedAt, undefined);
  assert.equal(await collection.countDocuments(), 1);
  assert.equal((await write(finish)).status, 409);
  assert.equal(
    (await collection.findOne({ _id: initial._id })).revision,
    record.revision,
  );
  checkRedirect(await request("/onboarding", { jar }), "/dashboard");
  checkRedirect(await request("/onboarding", { jar: otherJar }), "/dashboard");
  assert.equal((await request("/dashboard", { jar })).status, 200);
  console.log(
    "PASS onboarding transport/auth, validation, saved-step resume, shared admins, atomic revision conflicts, currency precision, optional date/venue, DB validator, completion and replay protection",
  );
}
