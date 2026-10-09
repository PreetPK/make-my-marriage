import type { Metadata } from "next";
export const metadata: Metadata = { referrer: "no-referrer" };
import Link from "next/link";
import type { ReactNode } from "react";

const features = [
  [
    "Events & Invitations",
    "Bring your celebrations, schedules, and venues together.",
  ],
  [
    "Guests & RSVPs",
    "Manage individual invitations and responses for each event.",
  ],
  [
    "Shared Wedding Memories",
    "Share event albums and original photographs through gallery links.",
  ],
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b border-bronze/20 bg-background/95">
        <a
          href="#auth-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-6 focus:top-6 focus:z-10 focus:bg-background focus:p-3"
        >
          Skip to content
        </a>
        <div className="mx-auto flex h-20 max-w-[1280px] items-center justify-between px-6 md:px-16">
          <Link
            href="/"
            aria-label="Make My Marriage home"
            className="flex flex-col leading-none"
          >
            <span className="mb-1 text-[10px] font-semibold tracking-[0.25em] text-secondary uppercase">
              Make My
            </span>
            <span className="font-serif text-xl text-primary">Marriage</span>
          </Link>
          <span className="text-[11px] tracking-widest text-secondary uppercase">
            Wedding Workspace
          </span>
        </div>
      </header>
      <main
        id="auth-content"
        className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-10 md:px-16 lg:py-16"
      >
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 text-xs tracking-wider text-secondary uppercase hover:text-primary"
        >
          <span aria-hidden="true">←</span>Back to homepage
        </Link>
        <div className="mt-8 grid items-start gap-12 lg:grid-cols-12 lg:gap-16">
          <section
            aria-labelledby="workspace-title"
            className="lg:col-span-7 lg:pr-8"
          >
            <div
              aria-hidden="true"
              className="mb-6 flex items-center gap-3 text-secondary"
            >
              <svg
                viewBox="0 0 48 48"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                className="size-10"
              >
                <path d="M24 6v36M12 24c4-7 12-7 12 0-4 7-12 7-12 0Zm24 0c-4-7-12-7-12 0 4 7 12 7 12 0ZM24 10c3 3 8 5 8 9m-8 19c-3-3-8-5-8-9" />
              </svg>
              <span className="h-px w-16 bg-secondary/40" />
              <span className="text-[11px] tracking-[0.25em] uppercase">
                Atelier Privé
              </span>
            </div>
            <p className="mb-3 font-serif text-2xl text-primary">
              Make My Marriage
            </p>
            <h1
              id="workspace-title"
              className="max-w-xl font-serif text-[36px] leading-tight text-primary lg:text-[42px]"
            >
              Every detail, beautifully together.
            </h1>
            <p className="mt-6 mb-10 max-w-lg text-lg leading-7 font-light text-muted">
              Manage your celebrations, welcome your guests, and keep your
              wedding memories in one place.
            </p>
            <ul className="max-w-md space-y-6">
              {features.map(([title, copy], index) => (
                <li key={title} className="flex gap-4">
                  <span
                    aria-hidden="true"
                    className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-panel font-serif text-secondary"
                  >
                    0{index + 1}
                  </span>
                  <div>
                    <h2 className="text-[11px] font-semibold tracking-wider text-primary uppercase">
                      {title}
                    </h2>
                    <p className="mt-1 text-[13px] leading-5 text-muted">
                      {copy}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-10 border-t border-bronze/20 pt-6 text-xs leading-5 text-secondary">
              For everyone managing the wedding. Guests use invitation and
              gallery links without accounts.
            </p>
          </section>
          <div className="lg:col-span-5">{children}</div>
        </div>
      </main>
      <footer className="bg-panel-light px-6 py-8 text-center text-xs leading-5 text-secondary">
        Make My Marriage · Bespoke wedding workspaces
      </footer>
    </div>
  );
}
