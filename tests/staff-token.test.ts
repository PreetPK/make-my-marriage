import { test } from "node:test";
import assert from "node:assert/strict";
import { isCurrentStaffToken } from "../src/server/auth/token-policy";
const now = 1_800_000_000_000;
const token = { sub: "staff", sessionVersion: 1, staffIssuedAt: now };
test("staff tokens enforce the absolute 12-hour boundary on every request", () => {
  assert(isCurrentStaffToken(token, now));
  assert(
    isCurrentStaffToken(
      { ...token, staffIssuedAt: now - 12 * 60 * 60_000 + 1 },
      now,
    ),
  );
  assert(
    !isCurrentStaffToken(
      { ...token, staffIssuedAt: now - 12 * 60 * 60_000 },
      now,
    ),
  );
  assert(!isCurrentStaffToken({ ...token, staffIssuedAt: now + 1 }, now));
});
test("malformed staff token policy claims fail closed", () => {
  for (const input of [
    null,
    {},
    { ...token, sub: undefined },
    { ...token, staffIssuedAt: NaN },
    { ...token, staffIssuedAt: Infinity },
    { ...token, sessionVersion: 0 },
    { ...token, sessionVersion: 1.5 },
    { ...token, sessionVersion: Number.MAX_SAFE_INTEGER + 1 },
  ])
    assert.equal(isCurrentStaffToken(input, now), false);
});
