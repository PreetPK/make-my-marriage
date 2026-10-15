// Test-process preload only. Never used by the application or development server.
import assert from "node:assert/strict";
assert.equal(process.env.ACCOUNT_TEST_MEMBERS_ONLY, "1");
assert.match(process.env.MONGODB_DATABASE, /^mmm_account_test_[a-z0-9_]+$/);
assert.match(process.env.APP_URL, /^http:\/\/127\.0\.0\.1:/);
assert.equal(process.env.RESEND_API_KEY, "fixture-not-a-real-key");
const original = globalThis.fetch;
const requests = new Map();
globalThis.fetch = async function (input, options) {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  if (url !== "https://api.resend.com/emails") return original(input, options);
  const request = new Request(input, options);
  const payload = await request.text();
  const body = JSON.parse(payload);
  const id = request.headers.get("Idempotency-Key");
  assert(id?.startsWith("staff-invitation/"));
  assert.equal(body.to.length, 1);
  assert(body.text.includes(process.env.APP_URL + "/accept-invitation?token="));
  const previous = requests.get(id);
  if (previous)
    assert.equal(
      previous.payload,
      payload,
      "A retry preserves the provider payload",
    );
  const count = (previous?.count ?? 0) + 1;
  requests.set(id, { payload: payload, count });
  if (body.to[0] === "retry-member@example.invalid" && count === 1)
    return Response.json({ message: "fixture rejection" }, { status: 403 });
  return Response.json({ id: "fixture-" + id.split("/")[1] });
};
