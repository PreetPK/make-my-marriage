import { z } from "zod";
export function validEventDate(value: string) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!m) return false;
  const day = Number(m[1]),
    month = Number(m[2]),
    year = Number(m[3]);
  if (year < 1900 || year > 9999 || month < 1 || month > 12) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return (
    day >= 1 &&
    day <=
      [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
  );
}
const date = z
  .string()
  .trim()
  .refine(validEventDate, "Enter a real date as DD/MM/YYYY (1900–9999).");
const time = z
  .string()
  .trim()
  .regex(
    /^([01]\d|2[0-3]):[0-5]\d$/,
    "Enter a time as HH:MM, using the 24-hour clock.",
  );
export const eventValuesSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Enter an event name.")
      .max(200, "Use 200 characters or fewer."),
    description: z.string().trim().max(2000, "Use 2,000 characters or fewer."),
    date,
    startTime: time,
    endDate: z
      .string()
      .trim()
      .refine(
        (v) => !v || validEventDate(v),
        "Enter a real end date as DD/MM/YYYY.",
      ),
    endTime: z
      .string()
      .trim()
      .refine(
        (v) => !v || /^([01]\d|2[0-3]):[0-5]\d$/.test(v),
        "Enter an end time as HH:MM.",
      ),
    venueName: z
      .string()
      .trim()
      .min(1, "Enter the venue name.")
      .max(200, "Use 200 characters or fewer."),
    venueAddress: z
      .string()
      .trim()
      .min(1, "Enter the venue address.")
      .max(1000, "Use 1,000 characters or fewer."),
    instructions: z.string().trim().max(1000, "Use 1,000 characters or fewer."),
  })
  .strict()
  .refine((v) => !v.endDate || Boolean(v.endTime), {
    path: ["endTime"],
    message: "Enter an end time, or clear the end date.",
  });
export const createEventSchema = z
  .object({
    clientRequestId: z.uuid(),
    expectedWeddingRevision: z
      .number()
      .int()
      .min(1)
      .max(Number.MAX_SAFE_INTEGER),
    values: eventValuesSchema,
  })
  .strict();
export const eventListSchema = z
  .object({
    q: z.string().trim().max(100).default(""),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();
export type EventValues = z.input<typeof eventValuesSchema>;
export const emptyEventValues: EventValues = {
  name: "",
  description: "",
  date: "",
  startTime: "",
  endDate: "",
  endTime: "",
  venueName: "",
  venueAddress: "",
  instructions: "",
};
export type EventContext = {
  timeZone: string;
  weddingRevision: number;
  hasEvents: boolean;
};
export type EventSummary = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string | null;
  venueName: string;
};
export type EventList = EventContext & {
  events: EventSummary[];
  page: number;
  q: string;
  hasNext: boolean;
};
// Accommodates maximum form fields even with six-byte JSON escapes per UTF-16 unit.
export const EVENT_REQUEST_BODY_LIMIT = 32 * 1024;
export const EVENT_PAGE_SIZE = 20;

export const editEventSchema = z
  .object({
    clientRequestId: z.uuid(),
    expectedRevision: z
      .number()
      .int()
      .min(1)
      .max(Number.MAX_SAFE_INTEGER - 1),
    values: eventValuesSchema,
  })
  .strict();
export type EventDetail = EventContext & {
  id: string;
  revision: number;
  values: EventValues;
};
