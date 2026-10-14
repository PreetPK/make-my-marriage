import "server-only";
import { ObjectId, type UpdateFilter } from "mongodb";
import type { CurrentStaff } from "@/server/auth/authorization";
import {
  coupleDetailsSchema,
  emptyOnboardingValues,
  onboardingWriteSchema,
  weddingSettingsSchema,
  type OnboardingState,
} from "../schemas";
import { findWedding, updateWedding, type WeddingRecord } from "./repository";

export class OnboardingError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 409,
    readonly code: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}
function checkStaff(staff: CurrentStaff, write = false) {
  if (
    !ObjectId.isValid(staff.weddingId) ||
    !ObjectId.isValid(staff.id) ||
    !["admin", "organizer"].includes(staff.role) ||
    (write && staff.role !== "admin")
  )
    throw new OnboardingError("Admin access is required.", 403, "FORBIDDEN");
}
export function weddingStateOf(record: WeddingRecord): OnboardingState {
  if (!Number.isSafeInteger(record.revision) || record.revision < 1)
    throw new Error("Wedding revision is unavailable.");
  const date =
    typeof record.weddingDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(record.weddingDate)
      ? record.weddingDate.split("-").reverse().join(" / ")
      : "";
  const values = {
    ...emptyOnboardingValues,
    brideName: record.couple?.partnerOneName ?? "",
    groomName: record.couple?.partnerTwoName ?? "",
    weddingDate: date,
    dateUndecided: record.onboarding?.dateUndecided ?? false,
    timeZone: record.timeZone ?? "",
    currency: record.currency ?? "",
    venueName: record.website?.venue?.name ?? "",
    venueAddress: record.website?.venue?.address ?? "",
    venueUndecided: record.onboarding?.venueUndecided ?? false,
  };
  for (const [key, value] of Object.entries(values)) {
    if (typeof value !== (key.endsWith("Undecided") ? "boolean" : "string"))
      throw new Error("Stored wedding details are invalid.");
  }
  if (record.weddingDate !== undefined && !date)
    throw new Error("Stored wedding date is invalid.");
  const coupleValid = coupleDetailsSchema.safeParse({
    brideName: values.brideName,
    groomName: values.groomName,
    weddingDate: values.weddingDate,
    dateUndecided: values.dateUndecided,
  }).success;
  const settingsValid = weddingSettingsSchema.safeParse({
    timeZone: values.timeZone,
    currency: values.currency,
  }).success;
  const complete = record.status === "active" && coupleValid && settingsValid;
  return {
    revision: record.revision,
    complete,
    values,
    step: !coupleValid
      ? 1
      : !settingsValid
        ? 2
        : record.onboarding?.step === 2
          ? 2
          : 3,
  };
}
export async function getOnboarding(staff: CurrentStaff) {
  checkStaff(staff);
  const record = await findWedding(staff.weddingId);
  if (!record) throw new Error("Wedding is unavailable.");
  return weddingStateOf(record);
}
export async function saveOnboarding(staff: CurrentStaff, input: unknown) {
  checkStaff(staff, true);
  const parsed = onboardingWriteSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      if (
        issue.path[0] === "values" &&
        typeof issue.path[1] === "string" &&
        !fields[issue.path[1]]
      )
        fields[issue.path[1]] = issue.message;
    throw new OnboardingError(
      "Please check the highlighted details.",
      400,
      "INVALID_INPUT",
      fields,
    );
  }
  const data = parsed.data;
  const record = await findWedding(staff.weddingId);
  if (!record) throw new Error("Wedding is unavailable.");
  const state = weddingStateOf(record);
  if (state.complete)
    throw new OnboardingError(
      "Wedding setup is already complete.",
      409,
      "SETUP_COMPLETE",
    );
  if (record.status !== "setup")
    throw new OnboardingError(
      "This wedding needs a setup review before it can be changed.",
      409,
      "SETUP_CHANGED",
    );
  if (state.revision !== data.expectedRevision)
    throw new OnboardingError(
      "Another admin updated these details. Load the latest saved details before continuing.",
      409,
      "SETUP_CHANGED",
    );
  if (
    (data.step === 2 && state.step === 1) ||
    (data.step === 3 &&
      (state.step === 1 ||
        !weddingSettingsSchema.safeParse({
          timeZone: state.values.timeZone,
          currency: state.values.currency,
        }).success))
  )
    throw new OnboardingError(
      "Complete the earlier steps first.",
      400,
      "EARLIER_STEP_REQUIRED",
    );
  const now = new Date();
  const update: UpdateFilter<WeddingRecord> = {
    $set: { updatedAt: now, updatedBy: new ObjectId(staff.id) },
    $inc: { revision: 1 },
  };
  if (data.step === 1) {
    Object.assign(update.$set!, {
      couple: {
        partnerOneName: data.values.brideName,
        partnerTwoName: data.values.groomName,
      },
      "onboarding.dateUndecided": Boolean(
        (input as { values: { dateUndecided: boolean } }).values.dateUndecided,
      ),
      "onboarding.step": 2,
    });
    if (data.values.weddingDate)
      Object.assign(update.$set!, { weddingDate: data.values.weddingDate });
    else update.$unset = { weddingDate: "" };
  } else if (data.step === 2) {
    Object.assign(update.$set!, {
      timeZone: data.values.timeZone,
      currency: data.values.currency,
      currencyMinorUnit: new Intl.NumberFormat("en", {
        style: "currency",
        currency: data.values.currency,
      }).resolvedOptions().maximumFractionDigits,
      "onboarding.step": 3,
    });
  } else {
    Object.assign(update.$set!, {
      status: "active",
      "onboarding.step": 3,
      "onboarding.completedAt": now,
      "onboarding.venueUndecided": data.values.venueUndecided,
    });
    if (data.values.venueName || data.values.venueAddress)
      update.$set!["website.venue"] = {
        name: data.values.venueName,
        address: data.values.venueAddress,
      };
    else update.$unset = { "website.venue": "" };
  }
  const updated = await updateWedding(
    staff.weddingId,
    data.expectedRevision,
    update,
  );
  if (!updated)
    throw new OnboardingError(
      "Another admin updated these details. Load the latest saved details before continuing.",
      409,
      "SETUP_CHANGED",
    );
  return weddingStateOf(updated);
}
