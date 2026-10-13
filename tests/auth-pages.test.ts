import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import type { Session } from "next-auth";

// These page tests use normal React to import client components. Emulate the
// server-only marker in this test process; application imports remain protected.
const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve("server-only");
require.cache[serverOnlyPath] = { exports: {} } as NodeJS.Module;
const nextAuthServer = require("next-auth/next") as {
  getServerSession: () => Promise<Session | null>;
};

test("login and signup redirect validated signed-in sessions; anonymous and invalid sessions keep the forms", async () => {
  const savedEnvironment = { ...process.env };
  process.env.NEXTAUTH_SECRET = "local-test-secret-with-at-least-32-characters";
  process.env.NEXTAUTH_URL = "http://localhost:3000";
  process.env.MONGODB_URI = "mongodb://localhost:27017";
  process.env.MONGODB_DATABASE = "local_mock_only";
  let validatedSession: Session | null = null;
  const sessionMock = mock.method(
    nextAuthServer,
    "getServerSession",
    async () => validatedSession,
  );
  try {
    const { default: loginPage } = await import("../src/app/(auth)/login/page");
    const { default: signupPage } =
      await import("../src/app/(auth)/signup/page");
    for (const page of [loginPage, signupPage]) {
      validatedSession = { user: { id: "active-staff-id" }, expires: "future" };
      await assert.rejects(page(), (error: unknown) => {
        assert(error instanceof Error && "digest" in error);
        assert.equal(error.digest, "NEXT_REDIRECT;replace;/dashboard;307;");
        return true;
      });
      validatedSession = null;
      assert(await page(), "Anonymous visitors can access the form");
      validatedSession = { expires: "future" };
      assert(
        await page(),
        "An invalidated session must not redirect back to the dashboard",
      );
    }
    delete process.env.NEXTAUTH_SECRET;
    sessionMock.mock.resetCalls();
    assert(await loginPage());
    assert(await signupPage());
    assert.equal(
      sessionMock.mock.callCount(),
      0,
      "Credential-free pages skip session lookup",
    );
  } finally {
    process.env = savedEnvironment;
    mock.restoreAll();
    delete require.cache[serverOnlyPath];
  }
});
