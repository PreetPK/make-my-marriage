import { WeddingHeader } from "@/features/wedding/components/wedding-header";
import { WeddingHero } from "@/features/wedding/components/wedding-hero";
import { WeddingStory } from "@/features/wedding/components/wedding-story";
import { WeddingCelebrations } from "@/features/wedding/components/wedding-celebrations";
import { WeddingInvitation } from "@/features/wedding/components/wedding-invitation";
import { WeddingGallery } from "@/features/wedding/components/wedding-gallery";
import { WeddingLivestream } from "@/features/wedding/components/wedding-livestream";
import { WeddingVenue } from "@/features/wedding/components/wedding-venue";
import { WeddingFooter } from "@/features/wedding/components/wedding-footer";

export default function HomePage() {
  return (
    <>
      <WeddingHeader />
      <main id="main-content">
        <WeddingHero />
        <WeddingStory />
        <WeddingCelebrations />
        <WeddingInvitation />
        <WeddingGallery />
        <WeddingLivestream />
        <WeddingVenue />
      </main>
      <WeddingFooter />
    </>
  );
}
