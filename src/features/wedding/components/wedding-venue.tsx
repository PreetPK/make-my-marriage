import Image from "next/image";
import { WeddingIcon } from "./wedding-ui";

export function WeddingVenue() {
  return (
    <section
      id="map"
      aria-labelledby="venue-title"
      className="scroll-mt-24 px-6 py-14 md:px-16"
    >
      <div className="mx-auto grid max-w-[1280px] items-center gap-14 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-5">
          <p className="section-eyebrow">The Destination</p>
          <h2 id="venue-title" className="section-title">
            The Oberoi Udaivilas
          </h2>
          <p className="text-[15px] leading-6 text-muted">
            Situated on the historic banks of Lake Pichola in Udaipur,
            Rajasthan, this sanctuary of domes, stone bridges, and peacocks
            stands as the backdrop for our gathering.
          </p>
          <ul className="space-y-3 pt-2 text-[13px] leading-5 text-muted">
            <li className="flex items-start gap-2">
              <WeddingIcon
                name="flight"
                className="size-5 shrink-0 text-secondary"
              />
              45 minutes from Maharana Pratap Airport (UDR)
            </li>
            <li className="flex items-start gap-2">
              <WeddingIcon
                name="hotel"
                className="size-5 shrink-0 text-secondary"
              />
              Guest concierge &amp; private boat shuttle provided
            </li>
          </ul>
          <a
            href="https://www.google.com/maps/search/?api=1&query=The+Oberoi+Udaivilas+Udaipur+Rajasthan+India"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 text-[11px] font-semibold tracking-widest text-primary uppercase hover:text-secondary"
          >
            Open in Google Maps
            <WeddingIcon name="external" className="size-4" />
          </a>
        </div>
        <figure className="overflow-hidden rounded-sm bg-panel-light shadow-sm lg:col-span-7">
          <Image
            src="/images/venue-map-preview.png"
            alt="Map of Udaipur and its lakes from the approved venue design"
            width={512}
            height={512}
            sizes="(min-width: 1024px) 600px, 100vw"
            className="mx-auto max-h-96 w-full object-contain"
          />
          <figcaption className="border-t border-bronze/20 px-4 py-3 text-center text-xs leading-5 text-secondary">
            Udaipur map preview · Open Google Maps for venue directions.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
