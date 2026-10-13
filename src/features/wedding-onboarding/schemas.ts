import { z } from "zod";

// Wedding dates are local calendar dates, not UTC instants.
function calendarDate(value: string) {
  const match = /^(\d{2})\s*\/\s*(\d{2})\s*\/\s*(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText),
    month = Number(monthText),
    year = Number(yearText);
  if (year < 1 || month < 1 || month > 12) return null;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day < 1 || day > days[month - 1]) return null;
  return `${yearText}-${monthText}-${dayText}`;
}

export const coupleDetailsSchema = z
  .object({
    brideName: z
      .string()
      .trim()
      .min(1, "Enter the bride’s name.")
      .max(200, "Use 200 characters or fewer."),
    groomName: z
      .string()
      .trim()
      .min(1, "Enter the groom’s name.")
      .max(200, "Use 200 characters or fewer."),
    weddingDate: z.string().trim().max(32),
    dateUndecided: z.boolean(),
  })
  .strict()
  .refine(
    (values) =>
      values.dateUndecided ||
      !values.weddingDate ||
      Boolean(calendarDate(values.weddingDate)),
    {
      path: ["weddingDate"],
      message:
        "Enter a valid date, or choose ‘We haven’t decided the date yet’.",
    },
  )
  .transform((values) => ({
    brideName: values.brideName,
    groomName: values.groomName,
    weddingDate:
      values.dateUndecided || !values.weddingDate
        ? null
        : calendarDate(values.weddingDate),
  }));

export type CoupleDetailsInput = z.input<typeof coupleDetailsSchema>;

export type SetupStep = 1 | 2 | 3;
export const weddingSettingsSchema = z
  .object({
    timeZone: z
      .string()
      .trim()
      .min(1, "Select your wedding time zone.")
      .max(100)
      .refine((value) => {
        if (
          value !== "UTC" &&
          !/^[A-Za-z_+-]+(?:\/[A-Za-z0-9_+-]+)+$/.test(value)
        )
          return false;
        try {
          new Intl.DateTimeFormat("en", { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }, "Select a valid wedding time zone."),
    currency: z
      .string()
      .trim()
      .refine(
        (value) => Intl.supportedValuesOf("currency").includes(value),
        "Select your wedding currency.",
      ),
  })
  .strict();
export const venueSchema = z
  .object({
    venueName: z.string().trim().max(200, "Use 200 characters or fewer."),
    venueAddress: z.string().trim().max(1000, "Use 1,000 characters or fewer."),
    venueUndecided: z.boolean(),
  })
  .strict()
  .transform((value) =>
    value.venueUndecided
      ? { ...value, venueName: "", venueAddress: "" }
      : value,
  );
const revision = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
export const onboardingWriteSchema = z.discriminatedUnion("step", [
  z
    .object({
      step: z.literal(1),
      expectedRevision: revision,
      values: coupleDetailsSchema,
    })
    .strict(),
  z
    .object({
      step: z.literal(2),
      expectedRevision: revision,
      values: weddingSettingsSchema,
    })
    .strict(),
  z
    .object({
      step: z.literal(3),
      expectedRevision: revision,
      values: venueSchema,
    })
    .strict(),
]);
export type OnboardingValues = CoupleDetailsInput &
  z.input<typeof weddingSettingsSchema> &
  z.input<typeof venueSchema>;
export type OnboardingState = {
  revision: number;
  step: SetupStep;
  complete: boolean;
  values: OnboardingValues;
};
export const emptyOnboardingValues: OnboardingValues = {
  brideName: "",
  groomName: "",
  weddingDate: "",
  dateUndecided: false,
  timeZone: "",
  currency: "",
  venueName: "",
  venueAddress: "",
  venueUndecided: false,
};
export function onboardingChoices() {
  return {
    timeZones: Array.from(
      new Set(["UTC", "Asia/Kolkata", ...Intl.supportedValuesOf("timeZone")]),
    ).sort(),
    currencies: Intl.supportedValuesOf("currency").map((code) => ({
      code,
      label: `${code} — ${new Intl.DisplayNames(["en"], { type: "currency" }).of(code) ?? code}`,
    })),
  };
}

// The server generates these choices with its ICU data. Browsers may have a
// different ICU version, so client selection checks use that supplied list;
// every write still passes the authoritative server settings schema above.
export function weddingSettingsSelectionSchema(choices: {
  timeZones: readonly string[];
  currencies: readonly { code: string }[];
}) {
  return z
    .object({
      timeZone: z
        .string()
        .refine(
          (value) => choices.timeZones.includes(value),
          "Select your wedding time zone.",
        ),
      currency: z
        .string()
        .refine(
          (value) =>
            choices.currencies.some((currency) => currency.code === value),
          "Select your wedding currency.",
        ),
    })
    .strict();
}
