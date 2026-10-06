import { PreviewButton, WeddingIcon } from "./wedding-ui";

export function WeddingInvitation() {
  return (
    <section aria-labelledby="invitation-title" className="px-6 py-14 md:px-16">
      <div className="relative mx-auto max-w-[880px] overflow-hidden rounded-sm bg-panel p-8 text-center shadow-sm md:p-14">
        <div
          aria-hidden="true"
          className="absolute -top-12 -left-12 size-28 rounded-full bg-bronze/20 blur-xl"
        />
        <div className="relative flex flex-col items-center">
          <WeddingIcon name="mail" className="mb-3 size-8 text-secondary" />
          <h2
            id="invitation-title"
            className="font-serif text-[32px] leading-10 text-primary"
          >
            Your invitation, your celebrations.
          </h2>
          <p className="mt-3 mb-8 max-w-lg text-[15px] leading-6 text-muted">
            Open your personal invitation from your email to view your invited
            events and share your RSVP.
          </p>
          <PreviewButton>
            View my invitation
            <WeddingIcon name="arrow" className="size-4" />
          </PreviewButton>
          <p className="mt-4 max-w-md text-xs leading-5 text-secondary">
            Invitation access is coming soon. No registration or public guest
            lookup needed.
          </p>
        </div>
      </div>
    </section>
  );
}
