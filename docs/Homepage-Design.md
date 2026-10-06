# Homepage design reference

Source: [Make My Marriage Website in Stitch](https://stitch.withgoogle.com/projects/12751053601206958162).
Approved desktop screen: `24755dbe812d46a19950f1e38ce3dcdc`.

The homepage implements the complete approved layout at `/`: header, hero,
story, celebrations, invitation access, gallery, livestream, venue, and footer.
The page composes feature components; the root layout remains responsible for the
document, metadata, global styles, and fonts. No external-service credentials are
required.

The couple names, November 2025 date, venue, and copy are preview content from
Stitch. Replace them with approved wedding settings when that feature is built.
Header, mobile-menu, footer, and hero links scroll to their sections with clearance
for the sticky header. Event details use native dialogs with keyboard dismissal
and focus return. The album QR preview expands using a native disclosure control.
The venue link opens a Google Maps search for the sample venue.

Invitation access, gallery actions, staff sign in, and livestream playback remain
disabled. QR illustrations are explicitly labeled not scannable, and the album
count is labeled as a sample. No guest information, real gallery photos, tokens, or
invitation-specific data are exposed. No credentials or additional packages are
needed to run the UI.

## Assets

`public/` contains public design assets only, never private guest uploads:

- `images/make-my-marriage-logo.png`: Stitch logo screen
  `9329528c761e4a10b8f19807b37e13ee`.
- `images/wedding-portrait.jpg`: Stitch portrait screen
  `28dc5f86e74243d5ba39625aa11ed22d`.
- `images/venue-map-preview.png`: map artwork from the approved HTML export.
  Its original map attribution is preserved; use the map link for directions.
- `fonts/`: Playfair Display regular/italic and Plus Jakarta Sans
  light/regular/semibold, downloaded from Google Fonts. Their SIL Open Font
  License files are included alongside the fonts. Next.js serves them locally
  using `next/font/local`; builds and browsers do not need Google Fonts access.

The original HTML's image URLs returned HTTP 403. The equivalent artwork was
retrieved through individual Stitch screens. The portrait export is 382 × 512
pixels; use a higher-resolution approved asset if a larger presentation is needed.

## Feature work still deferred

- Approved real wedding content and admin-managed settings.
- Server-validated shared wedding access and admin-approved general event visibility.
- Personal invitation links and event-specific RSVP.
- Gallery-link access, albums, uploads, original downloads, and real share QR codes.
- Configured YouTube livestream and staff authentication.

Connect data and services with their features. The visual mockup does not approve
public access to restricted events, albums, invitations, or uploads; consult the
PRD and API documents before adding behavior.
