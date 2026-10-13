import { test, mock } from "node:test";
import assert from "node:assert/strict";
import {
  coupleDetailsSchema,
  weddingSettingsSchema,
  weddingSettingsSelectionSchema,
  venueSchema,
  onboardingWriteSchema,
} from "../src/features/wedding-onboarding/schemas";

const values = {
  brideName: "  Asha  ",
  groomName: "  Dev  ",
  weddingDate: "",
  dateUndecided: false,
};
test("couple details allow an undecided date and preserve Unicode display names", () => {
  assert.deepEqual(coupleDetailsSchema.parse(values), {
    brideName: "Asha",
    groomName: "Dev",
    weddingDate: null,
  });
  assert.equal(
    coupleDetailsSchema.parse({
      ...values,
      brideName: "प्रीत",
      weddingDate: "not a date",
      dateUndecided: true,
    }).weddingDate,
    null,
  );
  assert.equal(
    coupleDetailsSchema.parse({ ...values, weddingDate: " 29 / 02 / 2028 " })
      .weddingDate,
    "2028-02-29",
  );
});
test("calendar validation rejects rollover dates and invalid leap years without a time zone", () => {
  for (const weddingDate of [
    "31/02/2027",
    "29/02/1900",
    "31/04/2027",
    "00/01/2027",
    "01/13/2027",
    "01/01/0000",
    "2027-02-28",
  ]) {
    const parsed = coupleDetailsSchema.safeParse({ ...values, weddingDate });
    assert.equal(parsed.success, false, weddingDate);
    if (!parsed.success)
      assert(
        parsed.error.issues.some((issue) => issue.path[0] === "weddingDate"),
      );
  }
  for (const weddingDate of ["29/02/2000", "28/02/2027", "31/12/2027"])
    assert.equal(
      coupleDetailsSchema.safeParse({ ...values, weddingDate }).success,
      true,
    );
});
test("names are required and bounded; unrelated fields are rejected", () => {
  for (const input of [
    { ...values, brideName: "  " },
    { ...values, groomName: "" },
    { ...values, brideName: "a".repeat(201) },
    { ...values, role: "admin" },
  ])
    assert.equal(coupleDetailsSchema.safeParse(input).success, false);
});

test("settings require an explicit supported currency and IANA time zone", () => {
  for (const values of [
    { timeZone: "", currency: "" },
    { timeZone: "not/a/zone", currency: "INR" },
    { timeZone: "+02:00", currency: "INR" },
    { timeZone: "UTC", currency: "ZZZ" },
    { timeZone: "UTC", currency: "inr" },
  ])
    assert.equal(weddingSettingsSchema.safeParse(values).success, false);
  for (const timeZone of ["UTC", "Asia/Kolkata", "Australia/Melbourne"])
    assert.equal(
      weddingSettingsSchema.safeParse({ timeZone, currency: "INR" }).success,
      true,
    );
});
test("venue is optional, bounded and ignored when undecided", () => {
  assert.deepEqual(
    venueSchema.parse({
      venueName: "",
      venueAddress: "",
      venueUndecided: false,
    }),
    { venueName: "", venueAddress: "", venueUndecided: false },
  );
  assert.deepEqual(
    venueSchema.parse({
      venueName: "Draft hall",
      venueAddress: "Draft address",
      venueUndecided: true,
    }),
    { venueName: "", venueAddress: "", venueUndecided: true },
  );
  assert.equal(
    venueSchema.safeParse({
      venueName: "",
      venueAddress: "a".repeat(1001),
      venueUndecided: false,
    }).success,
    false,
  );
});
test("writes require a safe revision and reject client-selected scope or completion", () => {
  const input = { step: 1, expectedRevision: 1, values };
  assert.equal(onboardingWriteSchema.safeParse(input).success, true);
  for (const expectedRevision of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, "1"])
    assert.equal(
      onboardingWriteSchema.safeParse({ ...input, expectedRevision }).success,
      false,
    );
  for (const extra of [
    { weddingId: "other" },
    { role: "admin" },
    { status: "active" },
    { completedAt: "now" },
  ])
    assert.equal(
      onboardingWriteSchema.safeParse({ ...input, ...extra }).success,
      false,
    );
});

test("browser settings validation trusts server choices without browser ICU dependence", () => {
  const unavailable = mock.method(Intl, "supportedValuesOf", () => {
    throw new Error("Older browser ICU");
  });
  try {
    const schema = weddingSettingsSelectionSchema({
      timeZones: ["Asia/Kolkata"],
      currencies: [{ code: "INR" }],
    });
    assert.equal(
      schema.safeParse({ timeZone: "Asia/Kolkata", currency: "INR" }).success,
      true,
    );
    assert.equal(
      schema.safeParse({ timeZone: "", currency: "" }).success,
      false,
    );
    assert.equal(
      schema.safeParse({ timeZone: "invalid/zone", currency: "INR" }).success,
      false,
    );
    assert.equal(unavailable.mock.callCount(), 0);
  } finally {
    unavailable.mock.restore();
  }
});
