import { test } from "node:test";
import assert from "node:assert/strict";
import {
  settingsWriteSchema,
  settingsValues,
  settingsClientSchema,
} from "../src/features/wedding-settings/schemas";
import {
  saveWeddingSettings,
  getWeddingSettings,
  WeddingSettingsError,
} from "../src/features/wedding-settings/server/service";
import type { CurrentStaff } from "../src/server/auth/authorization";
const draft = {
  brideName: " Asha ",
  groomName: " Dev ",
  weddingDate: "29/02/2028",
  dateUndecided: false,
  timeZone: "Australia/Melbourne",
  currency: "AUD",
  venueName: " Willow Hall ",
  venueAddress: "18 Garden Lane",
  venueUndecided: false,
};
const body = { expectedRevision: 4, values: settingsValues(draft) };
test("completed wedding settings normalize names/date and preserve explicit preferences", () => {
  const parsed = settingsWriteSchema.parse(body);
  assert.equal(parsed.values.couple.brideName, "Asha");
  assert.equal(parsed.values.couple.weddingDate, "2028-02-29");
  assert.equal(parsed.values.venue.venueName, "Willow Hall");
  assert.equal(parsed.values.preferences.currency, "AUD");
  const undecided = settingsWriteSchema.parse({
    ...body,
    values: settingsValues({
      ...draft,
      dateUndecided: true,
      venueUndecided: true,
    }),
  });
  assert.equal(undecided.values.couple.weddingDate, null);
  assert.equal(undecided.values.venue.venueName, "");
});
test("settings reject injected scope/publication fields, invalid revisions and partial form writes", () => {
  for (const extra of [
    { weddingId: "other" },
    { role: "admin" },
    { status: "active" },
    { expectedRevision: 0 },
    { expectedRevision: 1.5 },
    { expectedRevision: Number.MAX_SAFE_INTEGER + 1 },
    { values: { ...body.values, published: true } },
    {
      values: {
        ...body.values,
        couple: { ...body.values.couple, brideName: { $ne: null } },
      },
    },
    { values: { ...body.values, preferences: { currency: "AUD" } } },
  ])
    assert.equal(
      settingsWriteSchema.safeParse({ ...body, ...extra }).success,
      false,
    );
  assert.equal(
    settingsWriteSchema.safeParse({
      ...body,
      values: settingsValues({ ...draft, weddingDate: "31/02/2028" }),
    }).success,
    false,
  );
});
test("settings client accepts only server-offered preference choices", () => {
  const schema = settingsClientSchema({
    timeZones: ["Australia/Melbourne"],
    currencies: [{ code: "AUD", label: "AUD" }],
  });
  assert(schema.safeParse(body.values).success);
  assert(
    !schema.safeParse(settingsValues({ ...draft, currency: "INR" })).success,
  );
});
test("settings deny organizers and invalid identities before database access", async () => {
  const staff: CurrentStaff = {
    id: "000000000000000000000001",
    weddingId: "000000000000000000000002",
    name: "Test",
    email: "test@example.invalid",
    role: "organizer",
  };
  for (const actor of [
    staff,
    { ...staff, role: "admin" as const, id: "invalid" },
    { ...staff, role: "admin" as const, weddingId: "invalid" },
  ]) {
    await assert.rejects(
      getWeddingSettings(actor),
      (error) => error instanceof WeddingSettingsError && error.status === 403,
    );
    await assert.rejects(
      saveWeddingSettings(actor, body),
      (error) => error instanceof WeddingSettingsError && error.status === 403,
    );
  }
});
