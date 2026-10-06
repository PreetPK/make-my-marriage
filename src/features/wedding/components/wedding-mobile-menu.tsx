"use client";

import { useRef } from "react";
import { weddingNavigation } from "./wedding-navigation";
import { WeddingIcon } from "./wedding-ui";

export function WeddingMobileMenu() {
  const menu = useRef<HTMLDetailsElement>(null);
  return (
    <details ref={menu} className="relative xl:hidden">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-xs font-semibold text-primary [&::-webkit-details-marker]:hidden">
        <WeddingIcon name="menu" />
        <span className="sr-only sm:not-sr-only">Menu</span>
      </summary>
      <nav
        aria-label="Mobile wedding sections"
        className="absolute top-full right-0 mt-4 w-60 rounded-sm border border-bronze/20 bg-linen p-3 shadow-lg"
      >
        {weddingNavigation.map(({ label, href }) => (
          <a
            key={href}
            href={href}
            onClick={() => {
              if (menu.current) menu.current.open = false;
            }}
            className="block rounded-sm px-4 py-3 text-xs tracking-wider text-primary hover:bg-panel"
          >
            {label}
          </a>
        ))}
      </nav>
    </details>
  );
}
