import { PreviewButton, WeddingIcon } from "./wedding-ui";

export function WeddingLivestream() {
  return (
    <section
      id="watch-live"
      aria-labelledby="live-title"
      className="scroll-mt-24 bg-panel-light px-6 py-14 md:px-16"
    >
      <div className="mx-auto flex max-w-[1040px] flex-col items-center text-center">
        <p className="section-eyebrow">Virtual Attendance</p>
        <h2 id="live-title" className="section-title mt-2 mb-3">
          Celebrate with us, wherever you are.
        </h2>
        <p className="mb-8 max-w-2xl text-[15px] leading-6 text-muted">
          For cherished family and friends joining across time zones, our sacred
          wedding ceremony will be shared live from Udaipur.
        </p>
        <div className="relative flex min-h-72 w-full max-w-3xl flex-col items-center justify-center overflow-hidden rounded-sm bg-gradient-to-tr from-primary via-wine to-secondary px-6 py-10 text-white shadow-xl sm:aspect-video">
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-15 [background-image:radial-gradient(#f7f3eb_1px,transparent_1px)] [background-size:16px_16px]"
          />
          <div className="relative flex flex-col items-center">
            <span
              aria-hidden="true"
              className="mb-6 flex size-16 items-center justify-center rounded-full bg-white/15"
            >
              <WeddingIcon name="play" className="size-8" />
            </span>
            <h3 className="mb-3 font-serif text-2xl leading-8">
              The Sacred Wedding Ceremony
            </h3>
            <p className="text-xs leading-5 tracking-wide text-white/90">
              Sample schedule · Nov 22, 2025 • 4:30 PM IST
            </p>
            <p className="mt-4 rounded-sm border border-white/25 px-4 py-2 text-xs leading-5">
              Livestream preview · Playback is not available yet
            </p>
          </div>
        </div>
        <div className="mt-8">
          <PreviewButton>
            <WeddingIcon name="play" className="size-4" />
            Watch the celebration
          </PreviewButton>
        </div>
      </div>
    </section>
  );
}
