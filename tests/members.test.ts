import { test } from "node:test";
import assert from "node:assert/strict";
import {
  inviteMemberSchema,
  acceptInvitationSchema,
} from "../src/features/members/schemas";
import {
  invitationToken,
  tokenDigest,
  tokenMatches,
} from "../src/features/members/server/tokens";
import { removeSingletonRequirement } from "../src/features/wedding-onboarding/server/repository";
import { invitationEmailConfiguration } from "../src/server/providers/resend";
test("member inputs cannot select a wedding or an arbitrary admin role", () => {
  const input = {
    email: " partner@example.invalid ",
    role: "coowner",
    clientRequestId: "62c713c1-8a0e-4b28-a3ac-0b6a5ffbc5c8",
  };
  assert.equal(
    inviteMemberSchema.parse(input).email,
    "partner@example.invalid",
  );
  assert(!inviteMemberSchema.safeParse({ ...input, role: "admin" }).success);
  assert(
    !inviteMemberSchema.safeParse({ ...input, weddingId: "another" }).success,
  );
  const account = {
    email: input.email,
    name: "Partner",
    password: "Correct horse battery staple",
    confirmPassword: "Correct horse battery staple",
    token: "a".repeat(24) + "." + "b".repeat(64),
  };
  assert(acceptInvitationSchema.safeParse(account).success);
  assert(
    !acceptInvitationSchema.safeParse({
      ...account,
      confirmPassword: "different",
    }).success,
  );
  assert(
    !acceptInvitationSchema.safeParse({ ...account, role: "admin" }).success,
  );
});
test("invitation tokens are stable for retry, secret-bound and stored as hashes", () => {
  const previous = process.env.NEXTAUTH_SECRET;
  try {
    process.env.NEXTAUTH_SECRET = "fixture-secret-with-at-least-32-characters";
    const id = "a".repeat(24),
      token = invitationToken(id),
      digest = tokenDigest(token);
    assert.equal(invitationToken(id), token);
    assert(tokenMatches(token, digest));
    assert(!tokenMatches(token + "x", digest));
    assert(!tokenMatches(token, "invalid"));
    assert.notEqual(digest, token);
    process.env.NEXTAUTH_SECRET = "another-fixture-secret-with-32-characters";
    assert.notEqual(invitationToken(id), token);
  } finally {
    if (previous === undefined) delete process.env.NEXTAUTH_SECRET;
    else process.env.NEXTAUTH_SECRET = previous;
  }
});
test("singleton migration retains unrelated validation and supports old nested validators", () => {
  const previous = {
    $and: [
      {
        $jsonSchema: {
          required: ["singletonKey", "status"],
          properties: {
            singletonKey: { enum: ["primary"] },
            custom: { bsonType: "date" },
          },
        },
      },
      { $jsonSchema: { required: ["revision"] } },
    ],
  };
  const updated = removeSingletonRequirement(previous);
  assert.deepEqual(updated, {
    $and: [
      {
        $jsonSchema: {
          required: ["status"],
          properties: previous.$and[0].$jsonSchema.properties,
        },
      },
      previous.$and[1],
    ],
  });
  assert.deepEqual(previous.$and[0].$jsonSchema.required, [
    "singletonKey",
    "status",
  ]);
});
test("email configuration stays lazy and rejects unsafe sender/origin values", () => {
  const previous = { ...process.env };
  try {
    delete process.env.RESEND_API_KEY;
    assert.throws(invitationEmailConfiguration, /Configure/);
    process.env.RESEND_API_KEY = "fixture";
    process.env.STAFF_EMAIL_FROM = "Make My Marriage <onboarding@resend.dev>";
    process.env.APP_URL = "http://localhost:3000";
    assert.equal(
      invitationEmailConfiguration().from,
      process.env.STAFF_EMAIL_FROM,
    );
    process.env.APP_URL = "https://user:pass@example.invalid/";
    assert.throws(invitationEmailConfiguration);
    process.env.APP_URL = "http://localhost:3000";
    process.env.STAFF_EMAIL_FROM = "unsafe\n<onboarding@resend.dev>";
    assert.throws(invitationEmailConfiguration);
  } finally {
    process.env = previous;
  }
});
