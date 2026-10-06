import Image from "next/image";

// Preview content from the approved Stitch screen; wedding settings come later.
export function WeddingHero() {
  return (
    <section
      aria-labelledby="wedding-title"
      className="px-6 py-12 md:px-16 md:py-14"
    >
      <div className="mx-auto flex max-w-[1280px] flex-col items-center justify-between gap-12 lg:flex-row lg:gap-14">
        <div className="w-full space-y-4 lg:w-7/12">
          <p className="mb-5 flex items-center gap-2 text-[11px] font-semibold tracking-[0.25em] text-secondary uppercase">
            <span aria-hidden="true" className="h-px w-8 bg-secondary/40" />
            The nuptials of
          </p>
          <h1
            id="wedding-title"
            className="font-serif text-[48px] leading-[1.05] tracking-tight text-primary sm:text-[64px] xl:text-[72px]"
          >
            Aria{" "}
            <span className="text-[32px] font-normal text-secondary italic">
              &amp;
            </span>{" "}
            Rohan
          </h1>
          <p className="pt-1 font-serif text-2xl leading-8 text-secondary italic">
            A lifetime of love begins here.
          </p>
          <p className="max-w-xl text-lg leading-relaxed font-light text-muted">
            With our families, we invite you to celebrate our wedding amidst the
            quiet waters and regal courtyards of Rajasthan.
          </p>
          <div className="inline-flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl bg-panel px-4 py-3 text-xs leading-5 tracking-[0.04em] text-primary shadow-sm sm:py-2">
            <span className="flex items-center gap-2">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="size-[18px] shrink-0 text-secondary"
              >
                <rect x="4" y="5" width="16" height="16" rx="2" />
                <path d="M8 3v4m8-4v4M4 11h16" />
              </svg>
              <time dateTime="2025-11-22">Saturday, November 22, 2025</time>
            </span>
            <span
              aria-hidden="true"
              className="hidden text-secondary/40 sm:inline"
            >
              •
            </span>
            <span className="flex items-center gap-2">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="size-[18px] shrink-0 text-secondary"
              >
                <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
              The Oberoi Udaivilas, Udaipur
            </span>
          </div>
          <div className="pt-4">
            <a
              href="#celebrations"
              className="inline-flex min-h-11 items-center gap-2 rounded-sm bg-wine px-8 py-3 text-[11px] font-semibold tracking-[0.15em] text-white shadow-md transition-colors hover:bg-primary"
            >
              Explore the celebrations
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="size-4"
              >
                <path d="M4 12h16m-6-6 6 6-6 6" />
              </svg>
            </a>
          </div>
        </div>
        <div className="flex w-full justify-center lg:w-5/12 lg:justify-end">
          <figure className="w-full max-w-[340px] rounded-t-[140px] rounded-b-sm bg-panel-light p-2 shadow-xl">
            <div className="relative aspect-[3/4] overflow-hidden rounded-t-[130px] rounded-b-sm bg-panel">
              <Image
                src="/images/wedding-portrait.jpg"
                alt="Aria and Rohan together in a stone courtyard"
                fill
                sizes="(max-width: 387px) calc(100vw - 64px), 324px"
                preload
                className="object-cover object-center saturate-[0.92] contrast-[1.02]"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-primary/30 to-transparent"
              />
            </div>
            <figcaption className="pt-2 pb-1 text-center text-xs leading-4 tracking-[0.2em] text-secondary uppercase">
              Udaipur • MMXXV
            </figcaption>
          </figure>
        </div>
      </div>
      <div
        aria-hidden="true"
        className="mx-auto mt-16 h-px w-24 bg-secondary/30"
      />
    </section>
  );
}
