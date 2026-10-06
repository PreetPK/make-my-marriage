// Preview copy from the approved Stitch screen; wedding settings come later.
export function WeddingStory() {
  return (
    <section
      id="our-story"
      aria-labelledby="story-title"
      className="scroll-mt-24 px-6 py-8 md:px-16"
    >
      <div className="mx-auto flex max-w-[1040px] flex-col items-center text-center">
        <p className="mb-2 text-[11px] font-semibold tracking-[0.25em] text-secondary uppercase">
          Our Journey
        </p>
        <h2
          id="story-title"
          className="mb-2 max-w-2xl font-serif text-[32px] leading-10 tracking-tight text-primary md:text-[48px] md:leading-14"
        >
          From London afternoons to starlit horizons over Lake Pichola.
        </h2>
        <div aria-hidden="true" className="my-2 h-px w-12 bg-secondary/40" />
        <div className="mt-4 grid gap-6 text-left text-[15px] leading-6 text-muted md:grid-cols-2 md:gap-8">
          <p>
            What began with a chance encounter over monsoon rain in South
            Kensington quickly turned into endless conversations on art,
            heritage, and quiet ambitions. Over years of shared journeys across
            continents, we uncovered a gentle rhythm of mutual respect and
            unbounded devotion.
          </p>
          <p>
            As we return to the ancestral lands that shaped our families, our
            joy is multiplied by your presence. We gather not merely to exchange
            vows, but to honor the timeless ties of lineage, fellowship, and
            love that surround us on this sanctified threshold.
          </p>
        </div>
        <p className="mt-8 font-serif text-2xl leading-8 text-secondary italic">
          With love, Aria &amp; Rohan
        </p>
      </div>
      <div
        aria-hidden="true"
        className="mx-auto mt-16 h-px w-24 bg-secondary/30"
      />
    </section>
  );
}
