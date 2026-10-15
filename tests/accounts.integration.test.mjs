import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";

test(
  "Atlas signup creates separate owned weddings atomically and preserves session rules",
  { skip: !process.env.ACCOUNT_TEST_DATABASE },
  async () => {
    const testDatabase = process.env.ACCOUNT_TEST_DATABASE;
    assert.match(testDatabase, /^mmm_account_test_[a-z0-9_]+$/);
    assert.notEqual(testDatabase, process.env.MONGODB_DATABASE);
    process.env.MONGODB_DATABASE = testDatabase;
    delete process.env.RESEND_API_KEY;
    delete process.env.ACCOUNT_EMAIL_FROM;
    process.env.APP_URL = "http://localhost:3000";
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    process.env.NEXTAUTH_SECRET = randomBytes(32).toString("hex");
    const { getDatabase, closeDatabaseConnection } =
      await import("../src/server/db/mongodb.ts");
    const { signupAdmin } =
      await import("../src/features/accounts/server/service.ts");
    const { authOptions } = await import("../src/server/auth/config.ts");
    const db = await getDatabase();
    if (await db.listCollections().hasNext()) {
      await closeDatabaseConnection();
      assert.fail("Refuse to alter an existing test database");
    }
    try {
      await db.createCollection("users", {
        validator: {
          $jsonSchema: { bsonType: "object", required: ["adminSlot"] },
        },
      });
      await db
        .collection("users")
        .createIndex(
          { adminSlot: 1 },
          { unique: true, partialFilterExpression: { role: "admin" } },
        );
      await db.createCollection("weddings", {
        validator: {
          $jsonSchema: {
            bsonType: "object",
            required: ["singletonKey", "status", "revision"],
            properties: {
              singletonKey: { enum: ["primary"] },
              unrelatedDate: { bsonType: "date" },
            },
          },
        },
      });
      await db
        .collection("weddings")
        .createIndex({ singletonKey: 1 }, { unique: true });
      const values = {
        name: "Test Admin",
        email: "admin@example.invalid",
        password: "Test correct horse battery staple",
        confirmPassword: "Test correct horse battery staple",
      };
      await assert.rejects(signupAdmin({ ...values, role: "organizer" }));
      await assert.rejects(
        signupAdmin({ ...values, token: randomBytes(32).toString("hex") }),
      );
      const attempts = await Promise.allSettled([
        signupAdmin(values),
        signupAdmin(values),
      ]);
      assert.equal(
        attempts.filter((result) => result.status === "fulfilled").length,
        1,
        "Concurrent duplicate signup creates one account",
      );
      assert.match(
        attempts.find((result) => result.status === "fulfilled").value.message,
        /You can now sign in/,
      );
      const stored = await db
        .collection("users")
        .findOne({ emailNormalized: values.email });
      const owned = await db
        .collection("weddings")
        .findOne({ _id: stored.weddingId });
      assert(owned.ownerUserId.equals(stored._id));
      assert.equal(owned.singletonKey, undefined);
      await assert.rejects(
        db
          .collection("weddings")
          .updateOne(
            { _id: owned._id },
            { $set: { unrelatedDate: "invalid" } },
          ),
        (error) => error.code === 121,
      );
      assert.equal(
        await db.collection("weddings").countDocuments(),
        1,
        "Concurrent duplicate creates no orphan wedding",
      );
      assert.equal(stored.role, "admin");
      assert.equal(stored.status, "active");
      assert.equal(stored.emailVerifiedAt, undefined);
      assert.equal(stored.adminSlot, undefined);
      assert(
        !(await db
          .collection("users")
          .listIndexes()
          .toArray()
          .then((indexes) =>
            indexes.some((index) => index.name === "adminSlot_1"),
          )),
      );
      await assert.rejects(
        signupAdmin({ ...values, email: values.email.toUpperCase() }),
      );
      const options = authOptions(),
        authorize = options.providers[0].options.authorize;
      const input = {
        email: values.email,
        password: values.password,
        csrfToken: "native-csrf",
        callbackUrl: "/dashboard",
      };
      assert.equal(
        await authorize({ ...input, password: "Wrong password" }, {}),
        null,
      );
      const user = await authorize(input, {});
      assert.equal(user.id, stored._id.toHexString());
      const jwt = await options.callbacks.jwt({ token: {}, user });
      assert.equal(jwt.sub, user.id);
      const updated = await options.callbacks.jwt({
        token: jwt,
        trigger: "update",
        session: { role: "admin", sessionVersion: 99 },
      });
      assert.equal(updated.sessionVersion, 1);
      const session = await options.callbacks.session({
        session: { expires: "future" },
        token: jwt,
      });
      assert.deepEqual(session.user, { id: user.id });
      assert.equal(session.sessionVersion, undefined);
      assert.deepEqual(
        await options.callbacks.jwt({
          token: { ...jwt, staffIssuedAt: Date.now() - 12 * 60 * 60_000 },
        }),
        {},
      );
      for (const email of ["second@example.invalid", "third@example.invalid"]) {
        await signupAdmin({ ...values, email });
        const row = await db
          .collection("users")
          .findOne({ emailNormalized: email });
        assert.equal(row.role, "admin");
        assert.equal(row.status, "active");
        assert.notEqual(
          row.weddingId.toHexString(),
          stored.weddingId.toHexString(),
        );
        assert(await authorize({ ...input, email }, {}));
      }
      assert.equal(
        await db.collection("users").countDocuments({ role: "admin" }),
        3,
      );
      assert.equal(await db.collection("weddings").countDocuments({}), 3);
      await db
        .collection("users")
        .updateOne(
          { _id: stored._id },
          { $set: { status: "revoked" }, $inc: { sessionVersion: 1 } },
        );
      assert.equal(await authorize(input, {}), null);
      assert.deepEqual(await options.callbacks.jwt({ token: jwt }), {});
      const inviter = await db
        .collection("users")
        .findOne({ emailNormalized: "second@example.invalid" });
      await db.collection("weddings").updateOne(
        { _id: inviter.weddingId },
        {
          $set: {
            status: "active",
            couple: { partnerOneName: "Fixture", partnerTwoName: "Partner" },
            timeZone: "UTC",
            currency: "USD",
            onboarding: { completedAt: new Date() },
          },
        },
      );
      const { inviteMember, MemberError } =
        await import("../src/features/members/server/service.ts");
      const staff = {
        id: inviter._id.toHexString(),
        weddingId: inviter.weddingId.toHexString(),
        name: inviter.name,
        email: inviter.email,
        role: "admin",
      };
      const invitation = {
        email: "limited-invitation@example.invalid",
        role: "coowner",
        clientRequestId: randomUUID(),
      };
      const originalFetch = globalThis.fetch;
      let providerCalls = 0;
      process.env.RESEND_API_KEY = "fixture-not-a-real-key";
      process.env.STAFF_EMAIL_FROM = "Make My Marriage <onboarding@resend.dev>";
      globalThis.fetch = async (url) => {
        assert.equal(url, "https://api.resend.com/emails");
        providerCalls++;
        return Response.json(
          { message: "controlled rejection" },
          { status: 403 },
        );
      };
      try {
        await assert.rejects(
          inviteMember(staff, invitation),
          (error) => error instanceof MemberError && error.status === 503,
        );
        const window = Math.floor(Date.now() / 900000);
        await db
          .collection("authRateLimits")
          .updateOne(
            { _id: `invite:${staff.id}:${window}` },
            { $set: { count: 20, expiresAt: new Date((window + 1) * 900000) } },
            { upsert: true },
          );
        await assert.rejects(
          inviteMember(staff, invitation),
          (error) => error instanceof MemberError && error.status === 429,
        );
        assert.equal(
          providerCalls,
          1,
          "Replaying an existing invitation cannot bypass its send limit",
        );
        assert.equal(
          await db
            .collection("staffInvitations")
            .countDocuments({ emailNormalized: invitation.email }),
          1,
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    } finally {
      await db.dropDatabase();
      await closeDatabaseConnection();
    }
  },
);
