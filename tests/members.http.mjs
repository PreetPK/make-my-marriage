import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
export async function runMemberChecks({
  request,
  signup,
  login,
  BrowserCookies,
  db,
  origin,
  values,
  jar,
  secret,
  checkRedirect,
}) {
  const users = db.collection("users"),
    weddings = db.collection("weddings"),
    invitations = db.collection("staffInvitations");
  const owner = await users.findOne({ emailNormalized: values.email });
  const wedding = await weddings.findOne({ _id: owner.weddingId });
  assert(wedding.ownerUserId.equals(owner._id));
  const tokenOf = (invite) =>
    invite._id.toHexString() +
    "." +
    createHmac("sha256", secret)
      .update("staff-invitation:v1:" + invite._id.toHexString())
      .digest("hex");
  const post = (path, body, options = {}) =>
    request(path, {
      jar,
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify(body),
      ...options,
    });
  const invite = (email, role = "coowner", clientRequestId = randomUUID()) => ({
    email,
    role,
    clientRequestId,
  });
  const account = (email, token) => ({
    name: "Fixture Partner",
    email,
    token,
    password: values.password,
    confirmPassword: values.password,
  });
  const body = await (await request("/api/members", { jar })).json();
  assert.equal(body.members[0].label, "Owner");
  assert.equal((await request("/api/members")).status, 401);
  checkRedirect(await request("/members"), "/login");
  assert.equal(
    (
      await post("/api/members", invite("cross@example.invalid"), {
        headers: {
          "content-type": "application/json",
          origin: "https://attacker.invalid",
        },
      })
    ).status,
    403,
  );
  assert.equal(
    (await post("/api/members", invite("bad@example.invalid"), { body: "{" }))
      .status,
    400,
  );
  assert.equal(
    (
      await post("/api/members", invite("bad@example.invalid"), {
        body: "x".repeat(8193),
      })
    ).status,
    413,
  );
  assert.equal(
    (
      await post("/api/members", {
        ...invite("bad@example.invalid"),
        role: "admin",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await post("/api/members", {
        ...invite("bad@example.invalid"),
        weddingId: wedding._id.toHexString(),
      })
    ).status,
    400,
  );
  const partner = invite("partner-member@example.invalid");
  const outcomes = await Promise.all([
    post("/api/members", partner),
    post("/api/members", partner),
  ]);
  assert(
    outcomes.every((response) => response.status === 201),
    JSON.stringify(
      await Promise.all(
        outcomes.map(async (response) => ({
          status: response.status,
          body: await response.json(),
        })),
      ),
    ),
  );
  const pending = await invitations.findOne({ emailNormalized: partner.email });
  assert.equal(
    await invitations.countDocuments({ emailNormalized: partner.email }),
    1,
  );
  assert.equal(
    await users.countDocuments({ emailNormalized: partner.email }),
    1,
  );
  assert.equal(pending.delivery, "accepted_by_provider");
  assert.equal(
    (await signup({ ...values, email: partner.email })).status,
    400,
    "Invited recipient cannot create another wedding",
  );
  assert.equal(
    (await login(new BrowserCookies(), partner.email)).status,
    401,
    "Pending users cannot sign in",
  );
  assert.equal(
    (await post("/api/members", { ...partner, role: "organizer" })).status,
    409,
  );
  const token = tokenOf(pending);
  const forged = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
  assert.equal(
    (
      await post(
        "/api/accounts/accept-invitation",
        account(partner.email, forged),
        { jar: undefined },
      )
    ).status,
    400,
  );
  const userCollection = await db.listCollections({ name: "users" }).next();
  const originalValidator = userCollection.options.validator;
  await db.command({
    collMod: "users",
    validator: {
      $and: [
        originalValidator,
        {
          $or: [
            { emailNormalized: { $ne: partner.email } },
            { status: { $ne: "active" } },
          ],
        },
      ],
    },
  });
  try {
    assert.equal(
      (
        await post(
          "/api/accounts/accept-invitation",
          account(partner.email, token),
          { jar: undefined },
        )
      ).status,
      503,
    );
    assert.equal(
      (await invitations.findOne({ _id: pending._id })).status,
      "pending",
      "Storage rejection rolls token consumption back",
    );
    assert.equal(
      (await users.findOne({ emailNormalized: partner.email })).status,
      "invited",
    );
  } finally {
    await db.command({ collMod: "users", validator: originalValidator });
  }

  assert.equal(
    (await request("/accept-invitation?token=" + token)).status,
    200,
  );
  assert.equal(
    (
      await post(
        "/api/accounts/accept-invitation",
        account("wrong@example.invalid", token),
        { jar: undefined },
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await post(
        "/api/accounts/accept-invitation",
        { ...account(partner.email, token), role: "admin" },
        { jar: undefined },
      )
    ).status,
    400,
  );
  const accepted = await Promise.all([
    post("/api/accounts/accept-invitation", account(partner.email, token), {
      jar: undefined,
    }),
    post("/api/accounts/accept-invitation", account(partner.email, token), {
      jar: undefined,
    }),
  ]);
  assert.deepEqual(
    accepted.map((response) => response.status).sort(),
    [201, 400],
  );
  const coowner = await users.findOne({ emailNormalized: partner.email });
  assert(coowner.weddingId.equals(wedding._id));
  assert.equal(coowner.role, "admin");
  assert.equal(coowner.emailVerifiedAt, undefined);
  assert.equal(
    await weddings.countDocuments(),
    1,
    "Accepting creates no extra wedding",
  );
  const partnerJar = new BrowserCookies();
  assert.equal((await login(partnerJar, partner.email)).status, 200);
  assert.equal((await request("/dashboard", { jar: partnerJar })).status, 200);
  checkRedirect(
    await request("/onboarding", { jar: partnerJar }),
    "/dashboard",
  );
  assert.equal(
    (await request("/api/wedding/settings", { jar: partnerJar })).status,
    200,
  );
  const partnerMembers = await (
    await request("/api/members", { jar: partnerJar })
  ).json();
  assert.equal(
    partnerMembers.members.find((member) => member.email === partner.email)
      .label,
    "Co-owner",
  );
  assert.equal(
    (await post("/api/members/" + coowner._id, { action: "revoke" })).status,
    404,
    "Admin revocation denied",
  );
  assert.equal(
    (await post("/api/members/" + owner._id, { action: "revoke" })).status,
    404,
    "Owner revocation denied",
  );
  const organizerInput = invite(
    "organizer-member@example.invalid",
    "organizer",
  );
  assert.equal(
    (await post("/api/members", organizerInput, { jar: partnerJar })).status,
    201,
    "Co-owner can invite",
  );
  const organizerInvite = await invitations.findOne({
    emailNormalized: organizerInput.email,
  });
  assert.equal(
    (
      await post(
        "/api/accounts/accept-invitation",
        account(organizerInput.email, tokenOf(organizerInvite)),
        { jar: undefined },
      )
    ).status,
    201,
  );
  const organizer = await users.findOne({
      emailNormalized: organizerInput.email,
    }),
    organizerJar = new BrowserCookies();
  assert.equal((await login(organizerJar, organizerInput.email)).status, 200);
  assert.equal(
    (await request("/api/members", { jar: organizerJar })).status,
    403,
  );
  assert.equal(
    (
      await post("/api/members", invite("denied@example.invalid"), {
        jar: organizerJar,
      })
    ).status,
    403,
  );
  checkRedirect(await request("/members", { jar: organizerJar }), "/dashboard");
  assert.equal(
    (await request("/api/wedding/settings", { jar: organizerJar })).status,
    403,
  );
  const independentEmail = "independent-owner@example.invalid";
  assert.equal(
    (await signup({ ...values, email: independentEmail })).status,
    201,
  );
  const independent = await users.findOne({
    emailNormalized: independentEmail,
  });
  assert(!independent.weddingId.equals(wedding._id));
  const independentJar = new BrowserCookies();
  assert.equal((await login(independentJar, independentEmail)).status, 200);
  checkRedirect(
    await request("/dashboard", { jar: independentJar }),
    "/onboarding",
  );
  // Complete a second workspace to check isolation through all currently implemented APIs.
  const independentWedding = await weddings.findOne({
    _id: independent.weddingId,
  });
  await weddings.updateOne(
    { _id: independentWedding._id },
    {
      $set: {
        status: "active",
        couple: { partnerOneName: "Other", partnerTwoName: "Wedding" },
        timeZone: "UTC",
        currency: "USD",
        currencyMinorUnit: 2,
        onboarding: { completedAt: new Date() },
      },
    },
  );
  const otherMembers = await (
    await request("/api/members", { jar: independentJar })
  ).json();
  assert.equal(otherMembers.members.length, 1);
  assert.equal(otherMembers.members[0].email, independentEmail);
  assert.equal(
    (
      await post(
        "/api/members/" + organizer._id,
        { action: "revoke" },
        { jar: independentJar },
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await post(
        "/api/members/" + pending._id,
        { action: "retry" },
        { jar: independentJar },
      )
    ).status,
    404,
  );
  assert.equal(
    (await post("/api/members", invite(independentEmail))).status,
    409,
    "Cannot move an existing account into another wedding",
  );
  const eventInput = {
    clientRequestId: randomUUID(),
    expectedWeddingRevision: wedding.revision,
    values: {
      name: "Private wedding event",
      date: "20/10/2027",
      startTime: "14:00",
      endDate: "",
      endTime: "",
      venueName: "Private hall",
      venueAddress: "Fixture address",
      description: "",
      instructions: "",
    },
  };
  const eventResponse = await post("/api/events", eventInput);
  assert.equal(eventResponse.status, 201);
  const eventId = (await eventResponse.json()).id;
  assert.equal(
    (await request("/api/events/" + eventId, { jar: independentJar })).status,
    404,
  );
  const otherEvents = await (
    await request("/api/events", { jar: independentJar })
  ).json();
  assert(!JSON.stringify(otherEvents).includes("Private wedding event"));
  const currentSettings = await (
    await request("/api/wedding/settings", { jar })
  ).json();
  assert.equal(currentSettings.state.locks.timeZone, true);
  const settings = await (
    await request("/api/wedding/settings", { jar: independentJar })
  ).json();
  assert(!JSON.stringify(settings).includes("Asha"));
  const retryInput = invite("retry-member@example.invalid");
  assert.equal((await post("/api/members", retryInput)).status, 503);
  const retry = await invitations.findOne({
    emailNormalized: retryInput.email,
  });
  assert.equal(retry.delivery, "failed");
  assert.equal(
    (await post("/api/members/" + retry._id, { action: "retry" })).status,
    200,
  );
  assert.equal(
    (await invitations.findOne({ _id: retry._id })).delivery,
    "accepted_by_provider",
  );
  assert.equal(
    (await post("/api/members/" + retry._id, { action: "cancel" })).status,
    200,
  );
  assert.equal(
    await users.countDocuments({ emailNormalized: retryInput.email }),
    0,
  );
  assert.equal(
    (
      await post(
        "/api/accounts/accept-invitation",
        account(retryInput.email, tokenOf(retry)),
        { jar: undefined },
      )
    ).status,
    400,
  );
  assert.equal(
    (await post("/api/members", invite(retryInput.email))).status,
    503,
    "A new invitation is stored; fixture rejects its first send again",
  );
  assert.equal(
    await invitations.countDocuments({
      emailNormalized: retryInput.email,
      status: "pending",
    }),
    1,
  );
  assert.equal(
    await users.countDocuments({
      emailNormalized: retryInput.email,
      status: "invited",
    }),
    1,
  );
  const expiredInput = invite("expired-member@example.invalid");
  assert.equal((await post("/api/members", expiredInput)).status, 201);
  const expired = await invitations.findOne({
    emailNormalized: expiredInput.email,
  });
  await invitations.updateOne(
    { _id: expired._id },
    { $set: { expiresAt: new Date(Date.now() - 1) } },
  );
  assert.equal(
    (
      await post(
        "/api/accounts/accept-invitation",
        account(expiredInput.email, tokenOf(expired)),
        { jar: undefined },
      )
    ).status,
    400,
  );
  assert.equal(
    (await post("/api/members/" + expired._id, { action: "retry" })).status,
    409,
  );
  assert.equal(
    (await post("/api/members/" + organizer._id, { action: "revoke" })).status,
    200,
  );
  assert.equal(
    (await request("/api/events", { jar: organizerJar })).status,
    401,
  );
  checkRedirect(await request("/dashboard", { jar: organizerJar }), "/login");
  assert.equal(
    (await login(new BrowserCookies(), organizerInput.email)).status,
    401,
  );
  // A legacy primary wedding retains existing admins, without inventing its owner.
  const legacyId = new (await import("mongodb")).ObjectId();
  await weddings.insertOne({
    _id: legacyId,
    singletonKey: "primary",
    status: "active",
    revision: 1,
    couple: { partnerOneName: "Legacy", partnerTwoName: "Wedding" },
    timeZone: "UTC",
    currency: "USD",
  });
  await users.updateOne(
    { _id: independent._id },
    { $set: { weddingId: legacyId } },
  );
  const legacy = await (
    await request("/api/members", { jar: independentJar })
  ).json();
  assert.equal(legacy.members[0].label, "Admin");
  assert.equal(
    (await request("/api/wedding/settings", { jar: independentJar })).status,
    200,
  );
  console.log(
    "PASS separate wedding ownership, invitation reservation/concurrency, co-owner permissions, organizer denial/revocation, expired/cancelled/replayed tokens, stable mock email retries and legacy access; no real email sent",
  );
}
