import "server-only";
import { ObjectId, type UpdateFilter } from "mongodb";
import type { CurrentStaff } from "@/server/auth/authorization";
import {
  findWedding,
  type WeddingRecord,
} from "@/features/wedding-onboarding/server/repository";
import { weddingStateOf } from "@/features/wedding-onboarding/server/service";
import { settingsWriteSchema, type WeddingSettingsState } from "../schemas";
import { preferenceLocks, updateSettings } from "./repository";
import { WeddingSettingsError } from "./error";
export { WeddingSettingsError } from "./error";
function authorize(staff: CurrentStaff) {
  if (
    staff.role !== "admin" ||
    !ObjectId.isValid(staff.id) ||
    !ObjectId.isValid(staff.weddingId)
  )
    throw new WeddingSettingsError(
      "Admin access is required.",
      403,
      "FORBIDDEN",
    );
}
function activeState(record: WeddingRecord) {
  const state = weddingStateOf(record);
  if (!state.complete)
    throw new WeddingSettingsError(
      "Finish wedding setup before editing these settings.",
      409,
      "SETUP_REQUIRED",
    );
  return state;
}
export async function getWeddingSettings(
  staff: CurrentStaff,
): Promise<WeddingSettingsState> {
  authorize(staff);
  const [record, locks] = await Promise.all([
    findWedding(staff.weddingId),
    preferenceLocks(staff.weddingId),
  ]);
  if (!record) throw new Error("Wedding unavailable.");
  const state = activeState(record);
  return { revision: state.revision, values: state.values, locks };
}
export async function saveWeddingSettings(
  staff: CurrentStaff,
  input: unknown,
): Promise<WeddingSettingsState> {
  authorize(staff);
  const parsed = settingsWriteSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[2];
      if (typeof field === "string" && !fields[field])
        fields[field] = issue.message;
    }
    throw new WeddingSettingsError(
      "Please check the highlighted details.",
      400,
      "INVALID_INPUT",
      fields,
    );
  }
  const [record, locks] = await Promise.all([
    findWedding(staff.weddingId),
    preferenceLocks(staff.weddingId),
  ]);
  if (!record) throw new Error("Wedding unavailable.");
  activeState(record);
  const data = parsed.data;
  if (record.revision !== data.expectedRevision)
    throw new WeddingSettingsError(
      "Another admin updated these details. Load the latest saved details before saving.",
      409,
      "SETTINGS_CHANGED",
    );
  if (locks.timeZone && data.values.preferences.timeZone !== record.timeZone)
    throw new WeddingSettingsError(
      "The wedding time zone cannot change after events have been added.",
      409,
      "PREFERENCE_LOCKED",
      { timeZone: "Events already use this time zone." },
    );
  if (locks.currency && data.values.preferences.currency !== record.currency)
    throw new WeddingSettingsError(
      "The wedding currency cannot change after expenses have been added.",
      409,
      "PREFERENCE_LOCKED",
      { currency: "Expenses already use this currency." },
    );
  const raw = input as { values: { couple: { dateUndecided: boolean } } };
  const { couple, venue, preferences } = data.values;
  const update: UpdateFilter<WeddingRecord> = {
    $set: {
      "couple.partnerOneName": couple.brideName,
      "couple.partnerTwoName": couple.groomName,
      "onboarding.dateUndecided": raw.values.couple.dateUndecided,
      "onboarding.venueUndecided": venue.venueUndecided,
      timeZone: preferences.timeZone,
      currency: preferences.currency,
      currencyMinorUnit: new Intl.NumberFormat("en", {
        style: "currency",
        currency: preferences.currency,
      }).resolvedOptions().maximumFractionDigits,
      updatedAt: new Date(),
      updatedBy: new ObjectId(staff.id),
    },
    $inc: { revision: 1 },
    $unset: {},
  };
  if (couple.weddingDate)
    Object.assign(update.$set!, { weddingDate: couple.weddingDate });
  else Object.assign(update.$unset!, { weddingDate: "" });
  // Keep the venue object valid and preserve future instructions/content.
  Object.assign(update.$set!, {
    "website.venue.name": venue.venueName,
    "website.venue.address": venue.venueAddress,
  });
  const updated = await updateSettings(
    staff.weddingId,
    data.expectedRevision,
    update,
  );
  if (!updated)
    throw new WeddingSettingsError(
      "Another admin updated these details. Load the latest saved details before saving.",
      409,
      "SETTINGS_CHANGED",
    );
  const state = activeState(updated);
  return { revision: state.revision, values: state.values, locks };
}
