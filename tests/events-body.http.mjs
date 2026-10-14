import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  EVENT_REQUEST_BODY_LIMIT,
  createEventSchema,
  editEventSchema,
} from "../src/features/events/schemas.ts";
export async function runEventBodyChecks({ request, jar, db, origin }) {
  const headers = { "content-type": "application/json", origin };
  const context = (
    await (await request("/api/events?context=1", { jar })).json()
  ).context;
  const values = {
    name: "多文字の祝宴",
    description: "婚".repeat(2000),
    date: "19/02/2027",
    startTime: "14:00",
    endDate: "",
    endTime: "",
    venueName: "花の会場",
    venueAddress: "庭".repeat(1000),
    instructions: "式".repeat(1000),
  };
  const create = {
    clientRequestId: randomUUID(),
    expectedWeddingRevision: context.weddingRevision,
    values,
  };
  createEventSchema.parse(create);
  assert(Buffer.byteLength(JSON.stringify(create)) > 8192);
  assert(Buffer.byteLength(JSON.stringify(create)) <= EVENT_REQUEST_BODY_LIMIT);
  const response = await request("/api/events", {
    jar,
    method: "POST",
    headers,
    body: JSON.stringify(create),
  });
  assert.equal(response.status, 201);
  const { id } = await response.json(),
    path = "/api/events/" + id;
  try {
    const saved = (await (await request(path, { jar })).json()).event;
    assert.deepEqual(saved.values, values);
    // JSON escapes each control character to six ASCII bytes: a larger payload
    // than either three-byte CJK text or four-byte astral Unicode characters.
    const maximum = {
      ...values,
      name: "\u0001".repeat(200),
      description: "\u0001".repeat(2000),
      venueName: "\u0001".repeat(200),
      venueAddress: "\u0001".repeat(1000),
      instructions: "\u0001".repeat(1000),
    };
    const edit = {
      clientRequestId: randomUUID(),
      expectedRevision: saved.revision,
      values: maximum,
    };
    editEventSchema.parse(edit);
    assert(Buffer.byteLength(JSON.stringify(edit)) > 26000);
    assert(Buffer.byteLength(JSON.stringify(edit)) <= EVENT_REQUEST_BODY_LIMIT);
    assert.equal(
      (
        await request(path, {
          jar,
          method: "PATCH",
          headers,
          body: JSON.stringify(edit),
        })
      ).status,
      200,
    );
    assert.deepEqual(
      (await (await request(path, { jar })).json()).event.values,
      maximum,
    );
    // Create must also accept the maximum escaped form, not just edit.
    const revision = (
      await (await request("/api/events?context=1", { jar })).json()
    ).context.weddingRevision;
    const maxCreate = {
      clientRequestId: randomUUID(),
      expectedWeddingRevision: revision,
      values: maximum,
    };
    createEventSchema.parse(maxCreate);
    const created = await request("/api/events", {
      jar,
      method: "POST",
      headers,
      body: JSON.stringify(maxCreate),
    });
    assert.equal(created.status, 201);
    const extraId = (await created.json()).id;
    const { ObjectId } = await import("mongodb");
    await db.collection("events").deleteOne({ _id: new ObjectId(extraId) });
    for (const [url, method] of [
      ["/api/events", "POST"],
      [path, "PATCH"],
    ]) {
      const oversized = JSON.stringify({
        padding: "😊".repeat(EVENT_REQUEST_BODY_LIMIT / 4 + 1),
      });
      assert(Buffer.byteLength(oversized) > EVENT_REQUEST_BODY_LIMIT);
      assert.equal(
        (await request(url, { jar, method, headers, body: oversized })).status,
        413,
      );
      // Exercise the streamed cap without a Content-Length declaration.
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode("x".repeat(EVENT_REQUEST_BODY_LIMIT)),
          );
          controller.enqueue(new TextEncoder().encode("x"));
          controller.close();
        },
      });
      assert.equal(
        (
          await request(url, {
            jar,
            method,
            headers,
            body: stream,
            duplex: "half",
          })
        ).status,
        413,
      );
    }
    assert.equal(
      (
        await request("/api/accounts/signup", {
          method: "POST",
          headers,
          body: "x".repeat(8193),
        })
      ).status,
      413,
    );
  } finally {
    const { ObjectId } = await import("mongodb");
    await db.collection("events").deleteOne({ _id: new ObjectId(id) });
  }
  console.log(
    "PASS event create/edit accept multibyte and maximum escaped fields, enforce declared/streamed 32 KiB cap, and retain 8 KiB account cap",
  );
}
