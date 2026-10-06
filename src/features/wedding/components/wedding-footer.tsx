import { weddingNavigation } from "./wedding-navigation";

export function WeddingFooter() {
  return (
    <footer className="mt-14 border-t border-bronze/30 bg-linen px-6 py-14 md:px-16">
      <div className="mx-auto flex max-w-[1280px] flex-col items-center text-center">
        <div aria-hidden="true" className="mb-8 h-px w-16 bg-bronze/40" />
        <p className="max-w-2xl font-serif text-[32px] leading-10 text-primary italic">
          Your presence will make our celebration complete.
        </p>
        <p className="mt-6 mb-8 font-serif text-2xl text-primary">
          Make My Marriage
        </p>
        <nav
          aria-label="Footer wedding sections"
          className="mb-14 flex flex-wrap justify-center gap-x-8 gap-y-2"
        >
          {weddingNavigation.map(({ label, href }) => (
            <a
              key={href}
              href={href}
              className="inline-flex min-h-11 items-center text-xs tracking-wider text-muted hover:text-primary"
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="mb-8 h-px w-full max-w-xl bg-bronze/20" />
        <div className="flex w-full flex-col items-center justify-between gap-4 text-xs tracking-wide text-secondary sm:flex-row">
          <p>
            © {new Date().getFullYear()} Make My Marriage. All rights reserved.
          </p>
          <p className="tracking-[0.2em] uppercase">
            Curated Wedding Experience
          </p>
        </div>
      </div>
    </footer>
  );
}
