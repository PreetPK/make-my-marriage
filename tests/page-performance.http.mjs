import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
export async function runPagePerformanceChecks({
  request,
  signup,
  login,
  BrowserCookies,
  db,
  origin,
  values,
  skipMeasurements = false,
}) {
  assert.equal((await signup(values)).status, 201);
  const jar = new BrowserCookies();
  assert.equal((await login(jar)).status, 200);
  let revision = (
    await db.collection("weddings").findOne({ singletonKey: "primary" })
  ).revision;
  for (const [step, fields] of [
    [
      1,
      {
        brideName: "Asha",
        groomName: "Dev",
        weddingDate: "29/02/2028",
        dateUndecided: false,
      },
    ],
    [2, { timeZone: "Australia/Melbourne", currency: "AUD" }],
    [
      3,
      {
        venueName: "Willow Hall",
        venueAddress: "18 Garden Lane",
        venueUndecided: false,
      },
    ],
  ]) {
    const res = await request("/api/wedding/onboarding", {
      jar,
      method: "PATCH",
      headers: { "Content-Type": "application/json", origin },
      body: JSON.stringify({
        step,
        expectedRevision: revision,
        values: fields,
      }),
    });
    assert.equal(res.status, 200);
    revision = (await res.json()).state.revision;
  }
  if (skipMeasurements) return jar;
  const result = {};
  for (const path of ["/dashboard", "/wedding-settings"]) {
    const samples = [];
    for (let i = 0; i < 4; i++) {
      const start = performance.now();
      const res = await request(path, { jar });
      const firstByteMs = Math.round(performance.now() - start);
      assert.equal(res.status, 200);
      const body = await res.text();
      assert(
        body.includes(
          path === "/dashboard" ? "HTTP Test Admin" : "Wedding Settings",
        ),
      );
      samples.push({
        firstByteMs,
        completeMs: Math.round(performance.now() - start),
      });
    }
    const sorted = samples
      .slice(1)
      .map((s) => s.completeMs)
      .sort((a, b) => a - b);
    result[path] = { samples, warmMedianMs: sorted[1] };
  }
  console.log("PAGE_PERFORMANCE " + JSON.stringify(result));
}
