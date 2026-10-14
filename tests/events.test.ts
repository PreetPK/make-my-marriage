import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createEventSchema,
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
