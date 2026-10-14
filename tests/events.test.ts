import {
  readRequestBody,
  readAccountBody,
  RequestBodyError,
} from "../src/server/http/requests";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createEventSchema,
  EVENT_REQUEST_BODY_LIMIT,
  editEventSchema,
  eventListSchema,
  emptyEventValues,
} from "../src/features/events/schemas";
import {
  eventSchedule,
  localParts,
  resolveEventTime,
} from "../src/features/events/schedule";
const values = {
  ...emptyEventValues,
  name: " Ceremony ",
  date: "19/02/2027",
  startTime: "14:00",
  venueName: "Garden Pavilion",
  venueAddress: "18 Garden Lane",
};
test("event input requires real calendar dates, bounded content and explicit staff-safe fields", () => {
  assert.equal(
    createEventSchema.parse({
      clientRequestId: "00000000-0000-4000-8000-000000000001",
      expectedWeddingRevision: 1,
      values,
    }).values.name,
    "Ceremony",
  );
  for (const date of ["31/02/2027", "29/02/2027", "2027-02-19", "01/01/1899"])
    assert.equal(
      createEventSchema.safeParse({
        clientRequestId: "00000000-0000-4000-8000-000000000001",
        expectedWeddingRevision: 1,
        values: { ...values, date },
      }).success,
      false,
    );
  for (const extra of [
    { weddingId: "other" },
    { role: "admin" },
    { published: true },
    { clientRequestId: "bad" },
    { expectedWeddingRevision: 0 },
    { values: { ...values, visibility: "wedding_link" } },
    { values: { ...values, name: { $ne: null } } },
    { values: { ...values, endDate: "20/02/2027" } },
  ])
    assert.equal(
      createEventSchema.safeParse({
        clientRequestId: "00000000-0000-4000-8000-000000000001",
        expectedWeddingRevision: 1,
        values,
        ...extra,
      }).success,
      false,
    );
  assert.equal(
    eventListSchema.safeParse({ q: "x".repeat(101) }).success,
    false,
  );
  assert.equal(eventListSchema.safeParse({ page: "1;drop" }).success, false);
});
test("wedding zone determines UTC instants and overnight end dates", () => {
  const result = eventSchedule(
    { ...values, endDate: "20/02/2027", endTime: "01:00" },
    "Australia/Melbourne",
  );
  assert.deepEqual(result.fields, {});
  assert.equal(result.startsAt?.toISOString(), "2027-02-19T03:00:00.000Z");
  assert.equal(result.endsAt?.toISOString(), "2027-02-19T14:00:00.000Z");
  assert.deepEqual(localParts(result.endsAt!, "Australia/Melbourne"), {
    date: "20/02/2027",
    time: "01:00",
    second: "00",
  });
  assert(
    eventSchedule(
      { ...values, endDate: "", endTime: "01:00" },
      "Australia/Melbourne",
    ).fields.endTime,
  );
  assert.equal(
    resolveEventTime("19/02/2027", "00:00", "Asia/Kathmandu")[0].toISOString(),
    "2027-02-18T18:15:00.000Z",
  );
});
test("daylight-saving gaps and repeated wall times are rejected rather than shifted", () => {
  assert.equal(
    resolveEventTime("04/10/2026", "02:30", "Australia/Melbourne").length,
    0,
  );
  assert.equal(
    resolveEventTime("05/04/2026", "02:30", "Australia/Melbourne").length,
    2,
  );
  assert(
    eventSchedule(
      {
        ...values,
        date: "04/10/2026",
        startTime: "02:30",
        endDate: "",
        endTime: "",
      },
      "Australia/Melbourne",
    ).fields.startTime,
  );
  assert.equal(
    resolveEventTime("05/04/2026", "01:45", "Australia/Lord_Howe").length,
    2,
  );
  assert.equal(
    resolveEventTime("30/12/2011", "12:00", "Pacific/Apia").length,
    0,
  );
});

test("event edit contracts require an event revision and reject all operational/scope fields", () => {
  const body = {
    clientRequestId: "00000000-0000-4000-8000-000000000001",
    expectedRevision: 1,
    values: { ...values, endDate: "", endTime: "" },
  };
  assert.equal(editEventSchema.parse(body).values.name, "Ceremony");
  for (const extra of [
    { expectedRevision: 0 },
    { expectedRevision: Number.MAX_SAFE_INTEGER },
    { expectedRevision: 1.5 },
    { expectedWeddingRevision: 1 },
    { status: "archived" },
    { values: { ...body.values, visibility: "wedding_link" } },
    { values: { ...body.values, rsvp: { reminderEnabled: true } } },
    { values: { ...body.values, gallery: { acceptUploads: true } } },
  ])
    assert.equal(
      editEventSchema.safeParse({ ...body, ...extra }).success,
      false,
    );
});

test("event body cap accepts valid multibyte/max-escaped forms while keeping account limits separate", async () => {
  const base = {
    ...emptyEventValues,
    name: "式",
    date: "19/02/2027",
    startTime: "14:00",
    venueName: "庭",
    venueAddress: "庭".repeat(1000),
    description: "婚".repeat(2000),
    instructions: "式".repeat(1000),
  };
  const maximum = {
    ...base,
    name: "\u0001".repeat(200),
    venueName: "\u0001".repeat(200),
    venueAddress: "\u0001".repeat(1000),
    description: "\u0001".repeat(2000),
    instructions: "\u0001".repeat(1000),
  };
  for (const values of [base, maximum]) {
    for (const revision of [
      { expectedWeddingRevision: Number.MAX_SAFE_INTEGER },
      { expectedRevision: Number.MAX_SAFE_INTEGER - 1 },
    ]) {
      const payload = {
        clientRequestId: "00000000-0000-4000-8000-000000000001",
        ...revision,
        values,
      };
      const parsed =
        "expectedRevision" in revision
          ? editEventSchema.parse(payload)
          : createEventSchema.parse(payload);
      const json = JSON.stringify(parsed);
      assert(Buffer.byteLength(json) > 8192);
      assert(Buffer.byteLength(json) < EVENT_REQUEST_BODY_LIMIT);
      const request = () =>
        new Request("http://localhost:3000", { method: "POST", body: json });
      assert.equal(
        (await readRequestBody(request(), EVENT_REQUEST_BODY_LIMIT)).toString(
          "utf8",
        ),
        json,
      );
      await assert.rejects(
        readAccountBody(request()),
        (error) => error instanceof RequestBodyError && error.status === 413,
      );
    }
  }
});
test("event streamed byte cap enforces the exact boundary independently of Content-Length", async () => {
  const request = (body: string, headers: HeadersInit = {}) =>
    new Request("http://localhost:3000", { method: "POST", headers, body });
  assert.equal(
    (
      await readRequestBody(
        request("x".repeat(EVENT_REQUEST_BODY_LIMIT)),
        EVENT_REQUEST_BODY_LIMIT,
      )
    ).byteLength,
    EVENT_REQUEST_BODY_LIMIT,
  );
  const variants: HeadersInit[] = [
    {},
    { "content-length": "1" },
    { "content-length": String(EVENT_REQUEST_BODY_LIMIT + 1) },
  ];
  for (const headers of variants) {
    await assert.rejects(
      readRequestBody(
        request("😊".repeat(EVENT_REQUEST_BODY_LIMIT / 4 + 1), headers),
        EVENT_REQUEST_BODY_LIMIT,
      ),
      (error) => error instanceof RequestBodyError && error.status === 413,
    );
  }
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(EVENT_REQUEST_BODY_LIMIT));
      controller.enqueue(new Uint8Array(1));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    readRequestBody(
      new Request("http://localhost:3000", {
        method: "POST",
        body: stream,
        duplex: "half",
      } as RequestInit),
      EVENT_REQUEST_BODY_LIMIT,
    ),
    (error) => error instanceof RequestBodyError && error.status === 413,
  );
  assert(cancelled);
});
