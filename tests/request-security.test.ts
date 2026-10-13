import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isSameOrigin,
  readAccountBody,
  RequestBodyError,
} from "../src/server/http/requests";
import { POST } from "../src/app/api/accounts/signup/route";

test("account transport rejects malformed origins and unsafe inputs before database access", async () => {
  const saved = { ...process.env };
  process.env.APP_URL = "http://localhost:3000";
  delete process.env.MONGODB_URI;
  delete process.env.MONGODB_DATABASE;
  const request = (
    body: string,
    origin = "http://localhost:3000",
    type = "application/json",
  ) =>
    new Request("http://localhost:3000/api/accounts/signup", {
      method: "POST",
      headers: { origin, "content-type": type },
      body,
    });
  try {
    assert.equal(
      (await POST(request("{}", "https://attacker.example"))).status,
      403,
    );
    assert.equal(
      (await POST(request("{}", undefined, "application/json-invalid"))).status,
      415,
    );
    assert.equal((await POST(request("{"))).status, 400);
    assert.equal((await POST(request("x".repeat(8193)))).status, 413);
    assert.equal(
      (
        await POST(
          request(
            JSON.stringify({ email: { $ne: null }, password: { $gt: "" } }),
          ),
        )
      ).status,
      400,
    );
    const failed = await POST(
      request(
        JSON.stringify({
          name: "Test",
          email: "test@example.invalid",
          password: "Fictional test password",
          confirmPassword: "Fictional test password",
        }),
      ),
    );
    assert.equal(failed.status, 503);
    assert.equal(
      (await failed.json()).message,
      "Account service is temporarily unavailable.",
    );
    process.env.APP_URL = "invalid-config";
    assert.equal(isSameOrigin(request("{}")), false);
  } finally {
    process.env = saved;
  }
});
test("stream caps count actual bytes even without a truthful Content-Length", async () => {
  const request = new Request("http://localhost:3000", {
    method: "POST",
    body: "😊".repeat(2049),
    headers: { "content-length": "1" },
  });
  await assert.rejects(
    readAccountBody(request),
    (error: unknown) =>
      error instanceof RequestBodyError && error.status === 413,
  );
  const broken = new Request("http://localhost:3000", {
    method: "POST",
    body: new ReadableStream({
      start(controller) {
        controller.error(new Error("sensitive internal error"));
      },
    }),
    duplex: "half",
  } as RequestInit);
  await assert.rejects(
    readAccountBody(broken),
    (error: unknown) =>
      error instanceof RequestBodyError &&
      error.status === 400 &&
      error.message === "Invalid request.",
  );
});
