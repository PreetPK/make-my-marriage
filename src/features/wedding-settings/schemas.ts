import { z } from "zod";
import {
  coupleDetailsSchema,
  venueSchema,
  weddingSettingsSchema,
  weddingSettingsSelectionSchema,
  type OnboardingValues,
  type onboardingChoices,
} from "@/features/wedding-onboarding/schemas";
export const settingsValuesSchema = z
  .object({
    couple: coupleDetailsSchema,
    venue: venueSchema,
    preferences: weddingSettingsSchema,
  })
  .strict();
export const settingsWriteSchema = z
  .object({
    expectedRevision: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    values: settingsValuesSchema,
  })
  .strict();
export function settingsClientSchema(
  choices: ReturnType<typeof onboardingChoices>,
) {
  return settingsValuesSchema.extend({
    preferences: weddingSettingsSelectionSchema(choices),
  });
}
export function settingsValues(values: OnboardingValues) {
  return {
    couple: {
      brideName: values.brideName,
      groomName: values.groomName,
      weddingDate: values.weddingDate,
      dateUndecided: values.dateUndecided,
    },
    venue: {
      venueName: values.venueName,
      venueAddress: values.venueAddress,
      venueUndecided: values.venueUndecided,
    },
    preferences: { timeZone: values.timeZone, currency: values.currency },
  };
}
export type WeddingSettingsState = {
  revision: number;
  values: OnboardingValues;
  locks: { timeZone: boolean; currency: boolean };
};
