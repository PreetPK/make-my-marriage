import Image from "next/image";
import Link from "next/link";

import { weddingNavigation } from "./wedding-navigation";
import { WeddingMobileMenu } from "./wedding-mobile-menu";

export function WeddingHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-bronze/30 bg-linen/95 backdrop-blur-md">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-6 focus:top-6 focus:z-20 focus:bg-linen focus:px-4 focus:py-2"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between gap-6 px-6 md:px-16">
        <Link href="/" aria-label="Make My Marriage home" className="shrink-0">
          <Image
            src="/images/make-my-marriage-logo.png"
            alt="Make My Marriage — Bespoke Weddings"
            width={512}
            height={96}
            className="h-auto w-44 sm:w-56"
          />
        </Link>
        <nav aria-label="Wedding sections" className="hidden gap-8 xl:flex">
          {weddingNavigation.map(({ label, href }) => (
            <a
              key={href}
              href={href}
              className="text-[11px] font-semibold tracking-[0.15em] text-muted uppercase transition-colors hover:text-primary"
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <WeddingMobileMenu />
          <Link
            href="/login"
            aria-label="Staff sign in"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-white hover:bg-wine"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="size-[18px]"
            >
              <circle cx="12" cy="8" r="3" />
              <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
            </svg>
          </Link>
        </div>
      </div>
    </header>
  );
}
