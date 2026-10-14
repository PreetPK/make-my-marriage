import assert from "node:assert/strict";
import { runEventChecks } from "./events.http.mjs";
import { runPagePerformanceChecks } from "./page-performance.http.mjs";
import { runWeddingSettingsChecks } from "./wedding-settings.http.mjs";
import { runOnboardingChecks } from "./wedding-onboarding.http.mjs";
import { randomBytes, createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { encode } from "next-auth/jwt";

const databaseName = process.env.ACCOUNT_TEST_DATABASE;
assert.match(databaseName ?? "", /^mmm_account_test_[a-z0-9_]+$/);
assert.notEqual(databaseName, process.env.MONGODB_DATABASE);
assert(
  Buffer.byteLength(databaseName) <= 38,
  "Keep disposable Atlas database names within 38 bytes",
);
process.env.MONGODB_DATABASE = databaseName;
const { getDatabase, closeDatabaseConnection } =
  await import("../src/server/db/mongodb.ts");
const db = await getDatabase();
if (await db.listCollections().hasNext()) {
  await closeDatabaseConnection();
  assert.fail("Refuse to alter an existing test database");
}
const secret = randomBytes(32).toString("hex");
const origin = "http://127.0.0.1:3107";
const servers = [];
const password = "Test correct horse battery staple";
const values = {
  name: "HTTP Test Admin",
  email: "http-admin@example.invalid",
  password,
  confirmPassword: password,
};

class BrowserCookies {
  values = new Map();
  headers = [];
  capture(response) {
    for (const cookie of response.headers.getSetCookie()) {
      this.headers.push(cookie);
      const pair = cookie.split(";", 1)[0];
      const at = pair.indexOf("=");
      const name = pair.slice(0, at),
        value = pair.slice(at + 1);
      if (/Max-Age=0(?:;|$)/i.test(cookie) || value === "")
        this.values.delete(name);
      else this.values.set(name, value);
    }
  }
  header() {
    return [...this.values].map(([key, value]) => key + "=" + value).join("; ");
  }
}
async function startServer(port, overrides = {}) {
  const appUrl = "http://127.0.0.1:" + port;
  const child = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      env: {
        ...process.env,
        APP_URL: appUrl,
        NEXTAUTH_URL: appUrl,
        NEXTAUTH_SECRET: secret,
        RESEND_API_KEY: "",
        ACCOUNT_EMAIL_FROM: "",
        ...overrides,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  servers.push(child);
  child.stderr.on("data", () => {}); // Never emit framework/driver logs or credentials.
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Test server startup timed out")),
      45000,
    );
    child.once("exit", () => {
      clearTimeout(timer);
      reject(new Error("Test server exited before startup"));
    });
    child.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("Ready")) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
  return appUrl;
}
async function request(path, { jar, base = origin, ...options } = {}) {
  const headers = new Headers(options.headers);
  if (jar) headers.set("cookie", jar.header());
  const response = await fetch(base + path, {
    ...options,
    headers,
    redirect: "manual",
    signal: AbortSignal.timeout(25000),
  });
  jar?.capture(response);
  return response;
}
async function csrf(jar, base = origin) {
  return (await (await request("/api/auth/csrf", { jar, base })).json())
    .csrfToken;
}
async function login(jar, email = values.email, pass = password, extra = {}) {
  return request("/api/auth/callback/credentials", {
    jar,
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", origin },
    body: new URLSearchParams({
      csrfToken: await csrf(jar),
      email,
      password: pass,
      callbackUrl: "/dashboard",
      json: "true",
      ...extra,
    }),
  });
}
async function session(jar, base = origin) {
  return (await request("/api/auth/session", { jar, base })).json();
}
async function signup(input, options = {}) {
  return request("/api/accounts/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json", origin },
    body: JSON.stringify(input),
    ...options,
  });
}
async function waitForBrowser() {
  console.log(
    "BROWSER READY " +
      origin +
      "/signup — isolated fictional database " +
      databaseName +
      "; send Enter when browser checks finish",
  );
  process.stdin.resume();
  await once(process.stdin, "data");
  process.stdin.pause();
}
function checkRedirect(response, path) {
  assert.equal(response.status, 307);
  assert.equal(
    new URL(response.headers.get("location"), origin).pathname,
    path,
  );
}
try {
  await startServer(3107);
  if (process.env.ACCOUNT_TEST_EVENTS_ONLY === "1") {
    const jar = await runPagePerformanceChecks({
      request,
      signup,
      login,
      BrowserCookies,
      db,
      origin,
      values,
      skipMeasurements: true,
    });
    await runEventChecks({ request, jar, db, origin, checkRedirect });
    if (process.env.ACCOUNT_TEST_BROWSER === "1") await waitForBrowser();
  } else if (process.env.ACCOUNT_TEST_PERFORMANCE_ONLY === "1") {
    await runPagePerformanceChecks({
      request,
      signup,
      login,
      BrowserCookies,
      db,
      origin,
      values,
    });
    if (process.env.ACCOUNT_TEST_BROWSER === "1") await waitForBrowser();
  } else if (process.env.ACCOUNT_TEST_BROWSER_ONLY === "1") {
    // This mode is a manual-browser fixture, not a passing automated HTTP suite.
    await waitForBrowser();
  } else {
    checkRedirect(await request("/dashboard"), "/login");
    for (const path of ["/login", "/signup"])
      assert.equal((await request(path)).status, 200);
    assert.equal(
      (
        await signup(values, {
          headers: {
            "Content-Type": "application/json",
            origin: "https://attacker.example",
          },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await signup(values, {
          headers: { "Content-Type": "application/json" },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await signup(values, {
          headers: { "Content-Type": "text/plain", origin },
        })
      ).status,
      415,
    );
    assert.equal((await signup(values, { body: "{" })).status, 400);
    assert.equal(
      (await signup(values, { body: "x".repeat(8193) })).status,
      413,
    );
    for (const extra of [
      { role: "organizer" },
      { sessionVersion: 99 },
      { email: { $ne: null } },
      { password: { $gt: "" } },
    ])
      assert.equal((await signup({ ...values, ...extra })).status, 400);
    assert.equal(await db.collection("users").countDocuments(), 0);
    for (const path of [
      "/api/auth/callback/credentials",
      "/api/auth/signout",
      "/api/auth/session",
    ]) {
      assert.equal(
        (
          await request(path, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              origin,
            },
            body: "x".repeat(8193),
          })
        ).status,
        413,
      );
      assert.equal(
        (
          await request(path, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              origin: "https://attacker.example",
            },
            body: "",
          })
        ).status,
        403,
      );
    }
    assert.equal(
      (
        await request("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json", origin },
          body: "{",
        })
      ).status,
      400,
    );
    assert.equal((await request("/api/accounts/signup")).status, 405);
    const pageHeaders = (await request("/login")).headers;
    assert.equal(pageHeaders.get("x-frame-options"), "DENY");
    assert.equal(pageHeaders.get("x-content-type-options"), "nosniff");
    assert.equal(pageHeaders.get("referrer-policy"), "same-origin");
    assert.match(
      (await request("/api/auth/session")).headers.get("cache-control"),
      /no-store/,
    );
    console.log(
      "PASS anonymous access, cross-origin requests, malformed/oversized signup, injection, and extra fields",
    );

    assert.equal((await signup(values)).status, 201);
    const duplicate = await signup({
      ...values,
      email: values.email.toUpperCase(),
    });
    assert.equal(duplicate.status, 400);
    const stored = await db
      .collection("users")
      .findOne({ emailNormalized: values.email });
    assert.equal(stored.role, "admin");
    assert.equal(stored.status, "active");
    assert.equal(stored.emailVerifiedAt, undefined);
    assert.notEqual(stored.credential.passwordHash, password);
    const jar = new BrowserCookies();
    assert.equal(
      (await login(jar, values.email, "Wrong password")).status,
      401,
    );
    assert.equal((await session(jar)).user, undefined);
    const missingCsrf = await request("/api/auth/callback/credentials", {
      jar,
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", origin },
      body: new URLSearchParams({
        email: values.email,
        password,
        json: "true",
      }),
    });
    assert([200, 302].includes(missingCsrf.status));
    assert.equal((await session(jar)).user, undefined);
    assert.equal((await login(jar)).status, 200);
    assert.deepEqual((await session(jar)).user, {
      id: stored._id.toHexString(),
    });
    const cookie = jar.headers.findLast(
      (value) =>
        value.startsWith("next-auth.session-token=") &&
        !/Max-Age=0/i.test(value),
    );
    assert(cookie);
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);
    assert.match(cookie, /Path=\//i);
    assert(
      !/; Secure/i.test(cookie),
      "Loopback HTTP uses non-secure development cookies",
    );
    await runOnboardingChecks({
      request,
      signup,
      login,
      BrowserCookies,
      jar,
      db,
      checkRedirect,
      origin,
    });
    await runWeddingSettingsChecks({ request, jar, db, origin, checkRedirect });
    await runEventChecks({ request, jar, db, origin, checkRedirect });
    const sessionToken = jar.values.get("next-auth.session-token");
    assert(sessionToken);
    assert.equal(
      (
        await request("/api/wedding/settings", {
          headers: { authorization: "Bearer " + sessionToken },
        })
      ).status,
      401,
    );
    checkRedirect(
      await request("/dashboard", {
        headers: { authorization: "Bearer " + sessionToken },
      }),
      "/login",
    );
    const protectedPage = await request("/dashboard", { jar });
    assert.equal(protectedPage.status, 200);
    assert.match(protectedPage.headers.get("cache-control"), /no-store/);
    for (const path of ["/login", "/signup"])
      checkRedirect(await request(path, { jar }), "/dashboard");
    assert.equal((await request("/dashboard", { jar })).status, 200);
    const update = await request("/api/auth/session", {
      jar,
      method: "POST",
      headers: { "Content-Type": "application/json", origin },
      body: JSON.stringify({
        csrfToken: await csrf(jar),
        data: {
          role: "organizer",
          sessionVersion: 99,
          sub: "attacker",
          staffIssuedAt: Date.now() + 86400000,
        },
      }),
    });
    assert.equal(update.status, 200);
    assert.deepEqual((await session(jar)).user, {
      id: stored._id.toHexString(),
    });
    const otherTab = new BrowserCookies();
    otherTab.values = jar.values; // A shared browser cookie jar, not a separate device.
    assert.equal((await request("/dashboard", { jar: otherTab })).status, 200);
    const invalidSignout = await request("/api/auth/signout", {
      jar,
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", origin },
      body: new URLSearchParams({
        csrfToken: "invalid",
        callbackUrl: "/login",
        json: "true",
      }),
    });
    assert([200, 302].includes(invalidSignout.status));
    assert((await session(jar)).user);
    const signout = await request("/api/auth/signout", {
      jar,
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", origin },
      body: new URLSearchParams({
        csrfToken: await csrf(jar),
        callbackUrl: "/login",
        json: "true",
      }),
    });
    assert.equal(signout.status, 200);
    assert.equal((await session(jar)).user, undefined);
    checkRedirect(await request("/dashboard", { jar: otherTab }), "/login");
    console.log(
      "PASS real signup/login, session cookie flags, page redirects, refresh, client-claim rejection, CSRF logout, and shared-tab logout",
    );

    assert.equal((await login(jar)).status, 200);
    const forged = new BrowserCookies();
    forged.values.set("next-auth.session-token", "forged-token");
    checkRedirect(await request("/dashboard", { jar: forged }), "/login");
    const expired = new BrowserCookies();
    expired.values.set(
      "next-auth.session-token",
      await encode({
        secret,
        token: {
          sub: stored._id.toHexString(),
          sessionVersion: 1,
          staffIssuedAt: Date.now() - 13 * 3600000,
        },
        maxAge: 12 * 3600,
      }),
    );
    checkRedirect(await request("/dashboard", { jar: expired }), "/login");
    for (const invalid of [forged, expired]) {
      assert.equal(
        (await request("/api/wedding/settings", { jar: invalid })).status,
        401,
      );
      checkRedirect(
        await request("/wedding-settings", { jar: invalid }),
        "/login",
      );
    }
    for (const [staffIssuedAt, maxAge] of [
      [Date.now() + 60000, 12 * 3600],
      [Date.now(), -60],
    ]) {
      const invalid = new BrowserCookies();
      invalid.values.set(
        "next-auth.session-token",
        await encode({
          secret,
          token: {
            sub: stored._id.toHexString(),
            sessionVersion: 1,
            staffIssuedAt,
          },
          maxAge,
        }),
      );
      assert.equal(
        (await request("/api/wedding/settings", { jar: invalid })).status,
        401,
      );
      checkRedirect(await request("/dashboard", { jar: invalid }), "/login");
    }
    await db
      .collection("users")
      .updateOne({ _id: stored._id }, { $inc: { sessionVersion: 1 } });
    checkRedirect(await request("/dashboard", { jar }), "/login");
    assert.equal((await request("/login", { jar })).status, 200);
    assert.equal((await request("/api/wedding/settings", { jar })).status, 401);
    assert.equal((await login(jar)).status, 200);
    await db
      .collection("users")
      .updateOne({ _id: stored._id }, { $set: { status: "revoked" } });
    checkRedirect(await request("/dashboard", { jar }), "/login");
    assert.equal((await request("/api/wedding/settings", { jar })).status, 401);
    checkRedirect(await request("/wedding-settings", { jar }), "/login");
    assert.equal((await login(jar)).status, 401);
    console.log(
      "PASS forged, expired, stale-version, and revoked sessions fail closed",
    );

    const injectedName = "<script>alert('test')</script>";
    assert.equal(
      (
        await signup({
          ...values,
          name: injectedName,
          email: "xss@example.invalid",
        })
      ).status,
      201,
    );
    assert.equal((await login(jar, "xss@example.invalid")).status, 200);
    const html = await (await request("/dashboard", { jar })).text();
    assert(html.includes("&lt;script&gt;"));
    assert(!html.includes("<script>alert('test')</script>"));
    const redirectLogin = await login(jar, "xss@example.invalid", password, {
      callbackUrl: "https://attacker.example",
    });
    assert.equal((await redirectLogin.json()).url, origin + "/dashboard");
    console.log(
      "PASS stored display-name escaping and external callback redirect protection",
    );

    assert.equal(
      (await signup({ ...values, email: "limited@example.invalid" })).status,
      201,
    );
    for (let count = 0; count < 10; count++)
      assert.equal(
        (await login(new BrowserCookies(), "limited@example.invalid", "wrong"))
          .status,
        401,
      );
    assert.equal(
      (await login(new BrowserCookies(), "limited@example.invalid", password))
        .status,
      401,
    );
    const key = createHash("sha256")
      .update("limited@example.invalid")
      .digest("hex");
    assert.equal(
      (
        await db.collection("authRateLimits").findOne({
          _id: "login:" + key + ":" + Math.floor(Date.now() / 900000),
        })
      ).count,
      11,
    );
    const window = Math.floor(Date.now() / 900000);
    await db
      .collection("authRateLimits")
      .updateOne(
        { _id: "signup:global:" + window },
        { $set: { count: 120, expiresAt: new Date((window + 1) * 900000) } },
        { upsert: true },
      );
    const limited = await signup({
      ...values,
      email: "rate-new@example.invalid",
    });
    assert.equal(limited.status, 429, "Rate limiting must return HTTP 429");
    assert.equal(
      await db
        .collection("users")
        .countDocuments({ emailNormalized: "rate-new@example.invalid" }),
      0,
    );
    await db.collection("authRateLimits").deleteMany({});
    console.log("PASS persistent rate limits deny further work");

    const secureOrigin = await startServer(3110, {
      NEXTAUTH_URL: "https://marriage.example.invalid",
    });
    const secureCsrf = await request("/api/auth/csrf", { base: secureOrigin });
    const secureCookie = secureCsrf.headers
      .getSetCookie()
      .find((value) => value.startsWith("__Host-next-auth.csrf-token="));
    assert(secureCookie);
    assert.match(secureCookie, /; Secure/i);
    assert.match(secureCookie, /HttpOnly/i);
    assert.match(secureCookie, /SameSite=Lax/i);
    const secureJar = new BrowserCookies();
    const secureLogin = await request("/api/auth/callback/credentials", {
      base: secureOrigin,
      jar: secureJar,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        origin: secureOrigin,
      },
      body: new URLSearchParams({
        csrfToken: await csrf(secureJar, secureOrigin),
        email: "xss@example.invalid",
        password,
        json: "true",
      }),
    });
    assert.equal(secureLogin.status, 200);
    const secureSessionCookie = secureJar.headers.findLast((value) =>
      value.startsWith("__Secure-next-auth.session-token="),
    );
    assert(secureSessionCookie);
    assert.match(secureSessionCookie, /; Secure/i);
    assert.match(secureSessionCookie, /HttpOnly/i);
    assert.match(secureSessionCookie, /SameSite=Lax/i);
    console.log(
      "PASS HTTPS configuration selects Secure and host-prefixed CSRF cookies (not a deployed TLS test)",
    );
    if (process.env.ACCOUNT_TEST_BROWSER === "1") await waitForBrowser();
    const outageOrigin = await startServer(3108, {
      MONGODB_URI: "mongodb://127.0.0.1:1",
      MONGODB_DATABASE: databaseName,
    });
    const outage = await signup(
      { ...values, email: "outage@example.invalid" },
      {
        base: outageOrigin,
        headers: { "Content-Type": "application/json", origin: outageOrigin },
      },
    );
    assert.equal(outage.status, 503);
    assert.equal(
      (await outage.json()).message,
      "Account service is temporarily unavailable.",
    );
    const outageSessionJar = new BrowserCookies();
    outageSessionJar.values = new Map(jar.values);
    const outageSessionResponse = await request("/api/auth/session", {
      base: outageOrigin,
      jar: outageSessionJar,
    });
    assert.equal(outageSessionResponse.status, 200);
    assert.equal((await outageSessionResponse.json()).user, undefined);
    const outagePageJar = new BrowserCookies();
    outagePageJar.values = new Map(jar.values);
    checkRedirect(
      await request("/dashboard", { base: outageOrigin, jar: outagePageJar }),
      "/login",
    );
    const outageLoginJar = new BrowserCookies();
    const outageLogin = await request("/api/auth/callback/credentials", {
      base: outageOrigin,
      jar: outageLoginJar,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        origin: outageOrigin,
      },
      body: new URLSearchParams({
        csrfToken: await csrf(outageLoginJar, outageOrigin),
        email: "xss@example.invalid",
        password,
        json: "true",
      }),
    });
    assert.equal(outageLogin.status, 401);
    assert.equal((await session(outageLoginJar, outageOrigin)).user, undefined);
    console.log(
      "PASS database outage gives sanitized signup failure and denies login/session/dashboard access",
    );
    const unconfigured = await startServer(3109, {
      MONGODB_URI: "",
      MONGODB_DATABASE: "",
      NEXTAUTH_SECRET: "",
    });
    assert.equal((await request("/login", { base: unconfigured })).status, 200);
    assert.equal(
      (await request("/signup", { base: unconfigured })).status,
      200,
    );
    assert.equal(
      (await request("/api/auth/session", { base: unconfigured })).status,
      503,
    );
    console.log(
      "PASS credential-free pages and unconfigured authentication failure",
    );
  }
} finally {
  for (const child of servers) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
      await Promise.race([
        once(child, "exit"),
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);
      if (child.exitCode === null && child.signalCode === null)
        child.kill("SIGKILL");
    }
  }
  await db.dropDatabase();
  await closeDatabaseConnection();
  console.log(
    "CLEANUP temporary test database removed; application database untouched",
  );
}
