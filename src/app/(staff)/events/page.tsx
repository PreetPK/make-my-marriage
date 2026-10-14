import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff, type CurrentStaff } from "@/server/auth/authorization";
import { getEvents } from "@/features/events/server/service";
import { EventsLoading } from "@/features/events/components/events-loading";
import { eventListSchema, EVENT_PAGE_SIZE } from "@/features/events/schemas";
import { localParts } from "@/features/events/schedule";
export const metadata = { title: "Events | Make My Marriage" };
export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const staff = await requireStaff();
  const raw = await searchParams;
  const input = eventListSchema.safeParse({ q: raw.q, page: raw.page });
  if (!input.success) redirect("/events");
  return (
    <Suspense fallback={<EventsLoading />}>
      <EventsContent staff={staff} query={input.data} />
    </Suspense>
  );
}
async function EventsContent({
  staff,
  query,
}: {
  staff: CurrentStaff;
  query: { q: string; page: number };
}) {
  const state = await getEvents(staff, query);
  const pageLink = (page: number) =>
    `/events?${new URLSearchParams({ q: state.q, page: String(page) })}`;
  return (
    <section>
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="font-serif text-3xl text-primary">Events</h1>
          <p className="mt-2 text-sm text-secondary">
            Plan your wedding celebrations.
          </p>
        </div>
        {state.hasEvents && (
          <Link
            href="/events/new"
            className="inline-flex min-h-11 items-center rounded-sm bg-primary px-5 text-sm text-white hover:bg-primary/90"
          >
            Create event{" "}
            <span aria-hidden="true" className="ml-4">
              →
            </span>
          </Link>
        )}
      </div>
      <p className="mt-6 text-xs text-secondary">
        All times in {state.timeZone}.
      </p>
      {!state.hasEvents ? (
        <div className="mt-8 border border-bronze/20 bg-white px-8 py-20 text-center">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="mx-auto mb-6 h-10 w-10 text-bronze"
            fill="none"
            stroke="currentColor"
          >
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M7 2v6m10-6v6M3 11h18m-13 4h3" />
          </svg>
          <h2 className="font-serif text-2xl">No events yet</h2>
          <p className="mt-3 text-sm text-secondary">
            Add your first celebration with a date, time and venue.
          </p>
          <Link
            href="/events/new"
            className="mt-6 inline-flex min-h-11 items-center rounded-sm bg-primary px-5 text-sm text-white"
          >
            Create event →
          </Link>
        </div>
      ) : (
        <>
          <form action="/events" className="my-6 flex justify-end gap-2">
            <label htmlFor="event-search" className="sr-only">
              Search events
            </label>
            <input
              id="event-search"
              name="q"
              defaultValue={state.q}
              maxLength={100}
              placeholder="Search events…"
              className="min-h-11 border border-bronze/30 bg-white px-3 text-sm focus:outline-primary"
            />
            <button className="min-h-11 border border-bronze/30 px-4 text-sm">
              Search
            </button>
          </form>
          {state.events.length ? (
            <div className="overflow-x-auto border border-bronze/20 bg-white">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">
                  Wedding events in {state.timeZone}
                </caption>
                <thead className="bg-panel-light text-xs text-secondary">
                  <tr>
                    {["Event", "Date", "Time", "Venue", "Action"].map((h) => (
                      <th key={h} scope="col" className="px-5 py-4 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {state.events.map((event) => {
                    const start = localParts(
                        new Date(event.startsAt),
                        state.timeZone,
                      ),
                      end = event.endsAt
                        ? localParts(new Date(event.endsAt), state.timeZone)
                        : null;
                    return (
                      <tr key={event.id} className="border-t border-bronze/15">
                        <th
                          scope="row"
                          className="px-5 py-5 font-serif font-normal"
                        >
                          {event.name}
                        </th>
                        <td className="px-5 py-5 whitespace-nowrap">
                          {start.date}
                        </td>
                        <td className="px-5 py-5">
                          {start.time}
                          {end && `–${end.time}`}
                          {end && end.date !== start.date && (
                            <span className="mt-1 block text-xs text-secondary">
                              ends {end.date}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-5">{event.venueName}</td>
                        <td className="px-5 py-5">
                          <Link
                            href={`/events/${event.id}/edit`}
                            aria-label={`Edit ${event.name}`}
                            className="inline-flex min-h-11 items-center rounded-sm border border-bronze/30 px-4 text-xs"
                          >
                            Edit
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="border border-bronze/20 bg-white px-6 py-12 text-sm text-secondary">
              {state.q
                ? "No events match this search."
                : "No events on this page."}{" "}
              <Link href="/events" className="underline">
                Show all events
              </Link>
            </p>
          )}
          <div className="mt-5 flex items-center justify-between text-xs text-secondary">
            <p>
              {state.events.length
                ? `Showing ${(state.page - 1) * EVENT_PAGE_SIZE + 1}–${(state.page - 1) * EVENT_PAGE_SIZE + state.events.length}`
                : "No results"}
            </p>
            <nav aria-label="Event pages" className="flex items-center gap-4">
              {state.page > 1 && (
                <Link
                  className="inline-flex min-h-11 items-center underline"
                  href={pageLink(state.page - 1)}
                >
                  Previous
                </Link>
              )}
              <span>Page {state.page}</span>
              {state.hasNext && state.page < 1000 && (
                <Link
                  className="inline-flex min-h-11 items-center underline"
                  href={pageLink(state.page + 1)}
                >
                  Next
                </Link>
              )}
            </nav>
          </div>
        </>
      )}
      <p className="mt-8 text-xs text-secondary">
        Events are saved in your workspace. Guest invitations and website
        publication will be added later.
      </p>
    </section>
  );
}
