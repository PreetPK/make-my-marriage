import { PreviewButton, SampleQr, WeddingIcon } from "./wedding-ui";

const galleryFeatures = [
  {
    icon: "gallery" as const,
    title: "Photos organized by celebration",
    copy: "Categorized seamlessly by ceremony so you can revisit every ritual independently.",
  },
  {
    icon: "upload" as const,
    title: "Upload directly from your device",
    copy: "Instant guest photo sharing without an app or account creation.",
  },
  {
    icon: "download" as const,
    title: "View and download original photos",
    copy: "Full-resolution keepsakes for friends and family with a gallery sharing link.",
  },
];

export function WeddingGallery() {
  return (
    <section
      id="wedding-memories"
      aria-labelledby="gallery-title"
      className="scroll-mt-24 px-6 py-14 md:px-16"
    >
      <div className="mx-auto max-w-[1280px]">
        <div className="grid items-center gap-14 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-7">
            <p className="section-eyebrow">The Living Gallery</p>
            <h2 id="gallery-title" className="section-title max-w-xl">
              Share the moments that matter.
            </h2>
            <p className="max-w-xl text-lg leading-7 font-light text-muted">
              Explore our event albums, share your photographs, and download the
              memories you love with instantaneous ease.
            </p>
            <ul className="space-y-6 pt-2">
              {galleryFeatures.map((feature) => (
                <li key={feature.title} className="flex items-start gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-panel text-primary">
                    <WeddingIcon name={feature.icon} />
                  </span>
                  <div>
                    <h3 className="font-serif text-lg text-primary">
                      {feature.title}
                    </h3>
                    <p className="mt-1 text-[13px] leading-5 text-muted">
                      {feature.copy}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-4 pt-4">
              <PreviewButton>View event albums</PreviewButton>
              <PreviewButton secondary>Upload photos</PreviewButton>
            </div>
            <p className="text-xs leading-5 text-secondary">
              Gallery viewing and uploads are coming soon.
            </p>
          </div>
          <div className="flex justify-center lg:col-span-5">
            <div className="flex w-full max-w-sm flex-col items-center rounded-sm bg-white p-8 text-center shadow-xl">
              <span className="mb-3 flex size-9 items-center justify-center rounded-xl bg-panel text-secondary">
                <WeddingIcon name="qr" />
              </span>
              <h3 className="font-serif text-2xl text-primary">
                Scan to open gallery
              </h3>
              <p className="mt-2 mb-6 text-xs leading-5 text-muted">
                View and upload photos from your phone. No account needed.
              </p>
              <div className="mb-4 bg-white p-4 shadow-sm">
                <SampleQr />
              </div>
              <p className="mb-4 text-[10px] tracking-widest text-secondary uppercase">
                Sample QR · Not scannable
              </p>
              <PreviewButton secondary>
                Open gallery
                <WeddingIcon name="arrow" className="size-4" />
              </PreviewButton>
            </div>
          </div>
        </div>
        <div className="mt-14 rounded-sm bg-panel p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div className="flex items-start gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-sm bg-linen text-primary">
                <WeddingIcon name="gallery" className="size-6" />
              </span>
              <div>
                <p className="text-[11px] tracking-wider text-secondary uppercase">
                  Featured Event Collection · Sample Album
                </p>
                <h3 className="mt-1 font-serif text-2xl leading-8 text-primary">
                  Reception memories — 142 photos shared by guests
                </h3>
              </div>
            </div>
            <PreviewButton>Open album</PreviewButton>
          </div>
          <details className="group mt-6 border-t border-bronze/20 pt-4">
            <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-2 rounded-sm bg-background px-4 text-[11px] font-semibold tracking-wider text-primary uppercase [&::-webkit-details-marker]:hidden">
              <WeddingIcon name="qr" className="size-4" />
              <span className="group-open:hidden">Show sample album QR</span>
              <span className="hidden group-open:inline">
                Hide sample album QR
              </span>
            </summary>
            <div className="mt-6 flex flex-col items-center justify-between gap-6 border-l-2 border-primary bg-panel-light p-6 sm:flex-row">
              <div className="max-w-lg">
                <p className="section-eyebrow">Gallery sharing preview</p>
                <h4 className="mt-2 font-serif text-2xl text-primary">
                  Reception Memories QR
                </h4>
                <p className="mt-3 text-sm leading-6 text-muted">
                  An event-folder QR will open this album in the shared wedding
                  gallery. This sample is not scannable.
                </p>
              </div>
              <div className="shrink-0 bg-white p-3">
                <SampleQr small />
              </div>
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}
