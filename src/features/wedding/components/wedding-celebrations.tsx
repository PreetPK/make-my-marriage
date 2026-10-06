import { WeddingEventDetails } from "./wedding-event-details";
import { WeddingIcon } from "./wedding-ui";

// Public design samples only. Real event publication must be authorized by admins.
const celebrations = [
  {
    day: "Day One",
    title: "The Mehendi & Welcome Sangeet",
    date: "Friday, Nov 21, 2025 • 4:00 PM",
    venue: "The Courtyard Veranda",
    icon: "flower" as const,
    description:
      "Intricate henna patterns, regional folk instrumentation, and dusk melodies celebrating two families intertwining.",
  },
  {
    day: "Day Two",
    title: "The Sacred Wedding Ceremony",
    date: "Saturday, Nov 22, 2025 • 4:30 PM",
    venue: "Lakeside Mandap",
    icon: "heart" as const,
    description:
      "Vedic nuptial rites and the Seven Vows solemnized before the sacred fire during twilight over Lake Pichola.",
  },
  {
    day: "Day Three",
    title: "The Grand Reception & Dinner",
    date: "Sunday, Nov 23, 2025 • 7:30 PM",
    venue: "The Grand Ballroom & Terraces",
    icon: "sparkle" as const,
    description:
      "An evening of heartfelt toasts, royal Mewari culinary service, and midnight orchestral serenades under the stars.",
  },
];

export function WeddingCelebrations() {
  return (
    <section
      id="celebrations"
      aria-labelledby="celebrations-title"
      className="scroll-mt-24 bg-panel-light px-6 py-14 md:px-16"
    >
      <div className="mx-auto max-w-[1280px]">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <p className="section-eyebrow">Itinerary</p>
          <h2 id="celebrations-title" className="section-title mt-2">
            The Celebrations
          </h2>
          <p className="mt-2 text-[15px] leading-6 text-muted">
            Three days of cherished ceremonies and joy on the shores of Lake
            Pichola.
          </p>
        </div>
        <div
          id="celebration-cards"
          className="grid scroll-mt-28 gap-8 lg:grid-cols-3"
        >
          {celebrations.map((event, index) => (
            <article
              key={event.day}
              className="relative flex flex-col justify-between rounded-sm bg-white p-6 shadow-sm motion-safe:transition-transform motion-safe:hover:-translate-y-1 sm:p-8"
            >
              {index === 1 && (
                <p className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl bg-primary px-3 py-1 text-[10px] font-semibold tracking-wider whitespace-nowrap text-white uppercase">
                  Main Ceremony
                </p>
              )}
              <div>
                <div className="mb-3 flex items-center justify-between text-secondary">
                  <span className="text-xs tracking-widest uppercase">
                    {event.day}
                  </span>
                  <WeddingIcon name={event.icon} />
                </div>
                <h3 className="mb-3 font-serif text-2xl leading-8 text-primary">
                  {event.title}
                </h3>
                <p className="mb-3 text-xs leading-5 tracking-wide text-secondary">
                  {event.date}
                </p>
                <p className="mb-4 flex items-start gap-2 text-sm leading-6 text-muted">
                  <WeddingIcon
                    name="location"
                    className="mt-1 size-4 shrink-0 text-secondary"
                  />
                  {event.venue}
                </p>
                <p className="mb-8 text-[13px] leading-5 text-muted">
                  {event.description}
                </p>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-sm bg-panel-light px-3">
                <WeddingEventDetails {...event} />
                <a
                  href="#map"
                  className="inline-flex min-h-11 items-center gap-1 text-[11px] font-semibold tracking-wider text-secondary uppercase hover:text-primary"
                >
                  Directions
                  <WeddingIcon name="external" className="size-3" />
                </a>
              </div>
            </article>
          ))}
        </div>
        <p className="mt-8 text-center text-xs leading-5 text-secondary">
          Sample itinerary · Your personal invitation confirms the celebrations
          you are invited to.
        </p>
      </div>
    </section>
  );
}
