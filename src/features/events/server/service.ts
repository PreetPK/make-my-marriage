import "server-only";
import { ObjectId } from "mongodb";
import type { CurrentStaff } from "@/server/auth/authorization";
import {
  type WeddingRecord,
  findWedding,
} from "@/features/wedding-onboarding/server/repository";
import {
  createEventSchema,
  editEventSchema,
  type EventDetail,
  eventListSchema,
  EVENT_PAGE_SIZE,
  type EventContext,
  type EventList,
} from "../schemas";
import { localParts, eventSchedule } from "../schedule";
import {
  findEventRecord,
  updateEventRecord,
  eventExists,
  insertEvent,
  listEventRecords,
} from "./repository";
import { EventError } from "./error";
export { EventError } from "./error";
function authorize(staff: CurrentStaff) {
  if (
    !["admin", "organizer"].includes(staff.role) ||
    !ObjectId.isValid(staff.id) ||
    !ObjectId.isValid(staff.weddingId)
  )
    throw new EventError("Staff access is required.", 403, "FORBIDDEN");
}
function contextOf(
  wedding: WeddingRecord | null,
  hasEvents: boolean,
): EventContext {
  if (
    !wedding?.onboarding?.completedAt ||
    wedding.status !== "active" ||
    !wedding.timeZone
  )
    throw new EventError(
      "Finish wedding setup before managing events.",
      409,
      "SETUP_REQUIRED",
    );
  return {
    timeZone: wedding.timeZone,
    weddingRevision: wedding.revision,
    hasEvents,
  };
}
export async function getEventContext(
  staff: CurrentStaff,
): Promise<EventContext> {
  authorize(staff);
  const [wedding, hasEvents] = await Promise.all([
    findWedding(staff.weddingId),
    eventExists(staff.weddingId),
  ]);
  return contextOf(wedding, hasEvents);
}
export async function getEvents(
  staff: CurrentStaff,
  input: unknown,
): Promise<EventList> {
  authorize(staff);
  const parsed = eventListSchema.safeParse(input);
  if (!parsed.success)
    throw new EventError("Invalid event search or page.", 400, "INVALID_QUERY");
  const { q, page } = parsed.data;
  const [context, records] = await Promise.all([
    getEventContext(staff),
    listEventRecords(staff.weddingId, q, page),
  ]);
  return {
    ...context,
    q,
    page,
    hasNext: records.length > EVENT_PAGE_SIZE,
    events: records.slice(0, EVENT_PAGE_SIZE).map((r) => ({
      id: r._id.toHexString(),
      name: r.name,
      startsAt: r.startsAt.toISOString(),
      endsAt: r.endsAt?.toISOString() ?? null,
      venueName: r.venue.name,
    })),
  };
}
export async function createEvent(staff: CurrentStaff, input: unknown) {
  authorize(staff);
  const parsed = createEventSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] === "values" ? issue.path[1] : issue.path[0];
      if (typeof key === "string" && !fields[key]) fields[key] = issue.message;
    }
    throw new EventError(
      "Please check the event details.",
      400,
      "INVALID_INPUT",
      fields,
    );
  }
  return insertEvent(staff, parsed.data);
}

function eventIdOf(value: string) {
  if (!/^[a-f0-9]{24}$/i.test(value))
    throw new EventError("Invalid event ID.", 400, "INVALID_ID");
  return new ObjectId(value).toHexString();
}
export async function getEvent(
  staff: CurrentStaff,
  eventId: string,
): Promise<EventDetail> {
  authorize(staff);
  const id = eventIdOf(eventId);
  const [wedding, event] = await Promise.all([
    findWedding(staff.weddingId),
    findEventRecord(staff.weddingId, id),
  ]);
  if (!event)
    throw new EventError("This event is unavailable.", 404, "NOT_FOUND");
  const context = contextOf(wedding, true);
  const start = localParts(event.startsAt, context.timeZone),
    end = event.endsAt ? localParts(event.endsAt, context.timeZone) : null;
  return {
    ...context,
    id,
    revision: event.revision,
    values: {
      name: event.name,
      description: event.description ?? "",
      date: start.date,
      startTime: start.time,
      endDate: end?.date ?? "",
      endTime: end?.time ?? "",
      venueName: event.venue.name,
      venueAddress: event.venue.address,
      instructions: event.venue.instructions ?? "",
    },
  };
}
export async function saveEvent(
  staff: CurrentStaff,
  eventId: string,
  input: unknown,
) {
  authorize(staff);
  const id = eventIdOf(eventId);
  const parsed = editEventSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] === "values" ? issue.path[1] : issue.path[0];
      if (typeof key === "string" && !fields[key]) fields[key] = issue.message;
    }
    throw new EventError(
      "Please check the event details.",
      400,
      "INVALID_INPUT",
      fields,
    );
  }
  const context = contextOf(await findWedding(staff.weddingId), true);
  const schedule = eventSchedule(parsed.data.values, context.timeZone);
  if (Object.keys(schedule.fields).length || !schedule.startsAt)
    throw new EventError(
      "Please check the schedule.",
      400,
      "INVALID_INPUT",
      schedule.fields,
    );
  // Existing events lock the zone. This single-event revision update need not
  // serialize unrelated event edits or wedding-name/venue changes.
  return updateEventRecord(staff, id, parsed.data, {
    startsAt: schedule.startsAt,
    endsAt: schedule.endsAt,
  });
}
