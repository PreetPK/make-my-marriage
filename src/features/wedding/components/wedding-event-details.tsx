"use client";

import { useId, useRef } from "react";
import { WeddingIcon } from "./wedding-ui";

type CelebrationDetails = {
  title: string;
  date: string;
  venue: string;
  description: string;
};

export function WeddingEventDetails({
  title,
  date,
  venue,
  description,
}: CelebrationDetails) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="min-h-11 text-[11px] font-semibold tracking-wider text-primary uppercase hover:text-secondary"
      >
        View details<span className="sr-only">: {title}</span>
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="fixed inset-0 m-auto max-h-[85svh] w-[calc(100%_-_3rem)] max-w-lg overflow-y-auto rounded-sm bg-background p-6 text-foreground shadow-2xl backdrop:bg-primary/40 sm:p-8"
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-secondary uppercase">
            Sample celebration
          </p>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label="Close event details"
            className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-panel"
          >
            <WeddingIcon name="close" />
          </button>
        </div>
        <h2
          id={titleId}
          className="font-serif text-3xl leading-tight text-primary"
        >
          {title}
        </h2>
        <p className="mt-4 text-sm text-secondary">{date}</p>
        <p className="mt-2 flex items-center gap-2 text-sm text-secondary">
          <WeddingIcon name="location" />
          {venue}
        </p>
        <p className="mt-6 text-[15px] leading-7 text-muted">{description}</p>
        <p className="mt-6 border-t border-bronze/20 pt-4 text-xs leading-5 text-secondary">
          Use your personal email invitation for your invited events and RSVP.
        </p>
      </dialog>
    </>
  );
}
