import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { signupAdmin } from "../src/features/accounts/server/service";
import {
  findActiveStaff,
  type StaffUser,
} from "../src/features/accounts/server/repository";
import { closeDatabaseConnection } from "../src/server/db/mongodb";
import { authOptions } from "../src/server/auth/config";

test("public signup and immediate login work without email configuration; revoked accounts stay blocked", async () => {
  const savedEnvironment = { ...process.env };
  const users: StaffUser[] = [];
  const wedding = {
    _id: new ObjectId(),
    singletonKey: "primary",
    status: "setup",
  };
  const counts = new Map<string, number>();
  const fakeDb = {
    listCollections: () => ({ next: async () => null }),
    createCollection: async () => undefined,
    collection(name: string) {
      assert(
        ["users", "weddings", "authRateLimits"].includes(name),
        "No email token storage should be accessed",
      );
      return {
        createIndex: async () => "test-index",
        listIndexes: () => ({ toArray: async () => [] }),
        async findOne(filter: Record<string, unknown>) {
          if (name === "weddings") return wedding;
          return (
            users.find((user) => {
              if (filter.emailNormalized)
                return user.emailNormalized === filter.emailNormalized;
              return (
                user._id.equals(filter._id as ObjectId) &&
                user.status === filter.status &&
                user.sessionVersion === filter.sessionVersion &&
                !filter.emailVerifiedAt
              );
            }) ?? null
          );
        },
        async insertOne(user: StaffUser) {
          assert(
            !users.some(
              (existing) => existing.emailNormalized === user.emailNormalized,
            ),
          );
          users.push(user);
        },
        async findOneAndUpdate(filter: { _id: string }) {
          if (name === "weddings") return wedding;
          const count = (counts.get(filter._id) ?? 0) + 1;
          counts.set(filter._id, count);
          return { count };
        },
      };
    },
  };
  mock.method(
    MongoClient.prototype,
    "connect",
    async function (this: MongoClient) {
      return this;
    },
  );
  mock.method(MongoClient.prototype, "db", () => fakeDb as unknown as Db);
  mock.method(MongoClient.prototype, "close", async () => undefined);
  mock.method(globalThis, "fetch", async () => {
    throw new Error("Unexpected external request");
  });
  process.env.MONGODB_URI = "mongodb://localhost:27017";
  process.env.MONGODB_DATABASE = "local_mock_only";
  process.env.NEXTAUTH_SECRET = "local-test-secret-with-at-least-32-characters";
  process.env.NEXTAUTH_URL = "http://localhost:3000";
  delete process.env.RESEND_API_KEY;
  delete process.env.ACCOUNT_EMAIL_FROM;
  try {
    const values = {
      name: "Test Admin",
      email: "admin@example.invalid",
      password: "Correct horse battery staple",
      confirmPassword: "Correct horse battery staple",
    };
    for (const email of [
      values.email,
      "second@example.invalid",
      "third@example.invalid",
    ]) {
      assert.match(
        (await signupAdmin({ ...values, email })).message,
        /You can now sign in/,
      );
    }
    assert.equal(users.length, 3);
    for (const user of users) {
      assert.equal(user.role, "admin");
      assert.equal(user.status, "active");
      assert.equal(user.emailVerifiedAt, undefined);
      assert(user.weddingId.equals(wedding._id));
      assert(
        await findActiveStaff(user._id.toHexString(), user.sessionVersion),
      );
    }
    await assert.rejects(
      signupAdmin({ ...values, email: values.email.toUpperCase() }),
      /already exists/,
    );
    const provider = authOptions().providers[0] as unknown as {
      options: {
        authorize: (input: {
          email: string;
          password: string;
        }) => Promise<{ id: string } | null>;
      };
    };
    assert.equal(
      (await provider.options.authorize(values))?.id,
      users[0]._id.toHexString(),
    );
    assert.equal(
      await provider.options.authorize({ ...values, password: "wrong" }),
      null,
    );
    users[0].status = "revoked";
    assert.equal(await provider.options.authorize(values), null);
    assert.equal(await findActiveStaff(users[0]._id.toHexString(), 1), null);
  } finally {
    await closeDatabaseConnection();
    process.env = savedEnvironment;
    mock.restoreAll();
  }
});
