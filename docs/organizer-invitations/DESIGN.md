> Updated scope — 14 October 2026: the user approved public creation of independent
> weddings, one wedding per account, and invitations for Co-owner (admin) or Organizer.
> The implementation adapts these desktop drafts with an Invite as selector.
> The invitation-only-everywhere and organizer-only proposals below are historical,
> superseded by [the implemented Members rules](Implementation.md).

# Design System: Make My Marriage — Organizer invitations

## 1. Visual theme and atmosphere

A calm, balanced wedding planning workspace. Match the approved Events list b7433fe22d8b4ff182e1090d24511c8b and Edit event d59f4fc3add642d4ad14cb92403b8b04. Desktop only; mobile designs are deferred by the user.

## 2. Palette and roles

Blush #FEF8F5 canvas, white form/table surfaces, plum #301621 primary CTA/active navigation, charcoal #1D1B19 primary text, warm brown #705A45 secondary text, bronze #99816A subtle dividers. No neon, gradients or competing saturated accents.

## 3. Typography

Preserve user-approved Playfair Display headings (32px main, 22px sections) and Plus Jakarta Sans body/labels (14–16px). These established brand decisions override generic dashboard serif bans.

## 4. Components

240px plain wordmark sidebar (MAKE MY above Marriage); Dashboard, Events, Wedding Settings, Members active; bottom Sign out. No fake notification/profile widgets. Tables with fine rules rather than metric cards. Flat plum primary buttons, outline secondary, 44px targets, labels above inputs, focus outlines. Saving/loading disables relevant actions; inline errors retain entries.

## 5. Layout

1440px desktop composition, 40–48px main padding, max1100px content. Dedicated invite page max720px, left aligned. Acceptance uses the existing auth-page style without staff sidebar. Confirmation panels/modal only for destructive access changes, clear action/cancel copy.

## 6. Motion and interaction

Restrained transform/opacity feedback and reduced-motion support. No animation on settled content. Skeletons while loading. Expired/revoked invite shows a truthful unavailable message and instructs contact with an admin; no open signup fallback.

## 7. Anti-patterns

No photos, emojis, generic card grids, charts, invented guest counts, public sharing of invitation tokens, unrestricted role selectors, admin promotion/removal controls or claims of delivered emails. No mobile screens.

## Feature rules

Approved next policy: invite-only staff signup everywhere; existing admins retain access. First feature invites ORGANIZERS only, by email, from a current admin. Password 15–128 characters, no forced symbols; staff sessions12h. Invitations48h (previously approved). Separate email verification remains deferred; acceptance does not claim verified email.
Admin manages organizers; organizers cannot invite/revoke staff or access settings/expenses/reminders/admin publication/photo deletion. Event management works now; guests/invitations/RSVP/gallery/planner permissions apply as their features arrive.
References use fictional Asha/Dev wedding and maya@example.invalid organizer. Never send an actual email or expose any credentials as part of design generation.

## Status and decisions — 14 October 2026

Design drafts only; visual approval and implementation are pending.
[Stitch project](https://stitch.withgoogle.com/projects/12751053601206958162).
References: [PRD REQ-01/REQ-10](../Make-My-Marriage-PRD.md),
[API design](../Make-My-Marriage-API-Design.md),
[database reference](../Make-My-Marriage-Database-Technical-Reference.md),
[current staff implementation](../Staff-Authentication.md).

Approved next policy: invite-only staff signup everywhere, retaining existing active
admins. This supersedes the public-admin signup direction for future implementation,
but the running app still has public signup until its replacement is built/tested.
No existing admins are demoted; no two-admin cap is reinstated. Email verification
remains deferred. The existing 15–128-character password/12-hour session policy and
previously approved 48-hour invitation expiry carry forward.

The first proposed slice is Members list, organizer invitation/acceptance,
cancellation of pending invitations and revocation of active organizer access.
Admins alone manage these actions. No admin promotion/deletion controls are added.
Invitations are single-use, bound to their normalized recipient and the existing
wedding; client-provided roles never grant access. Cancellation/revocation must
invalidate pending links and active session access without deleting wedding records.

## Delivery setup

The user reports adding an API key locally; it was not read, validated or sent
anywhere. Use RESEND_API_KEY and STAFF_EMAIL_FROM (mapped to Resend's from field).
For development, STAFF_EMAIL_FROM="Make My Marriage <onboarding@resend.dev>".
The provider client/configuration reader is not implemented, so setting these
variables alone does not enable app emails. Commented safe examples are recorded
in .env.example; do not commit .env.local or use NEXT_PUBLIC_* for this key.

The user chose to defer domain setup. Resend's development sender can send only
to the Resend account email; it cannot deliver real invitations to arbitrary
organizers. The app must surface failure truthfully, preserve the address and never
silently redirect recipient emails. A verified owned domain and matching sender
will be needed before sending to other recipients.
[Official testing restriction](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain),
[domain setup](https://resend.com/docs/add-a-domain).
An invitation must use an app URL reachable by the recipient; localhost is local
only. No email, DNS changes or provider provisioning was performed for these drafts.

## Remaining implementation choices

- Confirm exact behavior for an already registered recipient. Existing admins
  must keep their role; an invitation must never downgrade/promote them. Existing
  users should sign in to accept, not reset their password through signup.
- Define reinviting a revoked organizer, replacement/resend rules and expired/
  cancelled/already-used invitation states. A new invitation for restoration is
  proposed in the revoke draft, not an implemented or separately approved rule.
- Plan a controlled admin bootstrap for fresh databases with signup closed;
  preserve existing admins and avoid restoring a public admin-creation endpoint.
- Add the server-only Resend client after checking its stable package compatibility,
  durable retry/deduplication behavior and a controlled recipient test. Inngest
  remains the approved background provider; no jobs are implemented by this draft.
- Test direct API/page permissions, invite token binding/lifetime/replays, public
  signup denial, role tampering, revocation/Back behavior, email failure and retries.

## Draft screen references

| Screen                               | ID                                 |
| ------------------------------------ | ---------------------------------- |
| Invite Organizer                     | `f8f36964a5a54feaa7c103fc03a29f60` |
| Revoke Organizer Access Confirmation | `afc183f2fc6743be90f84733e646e871` |
| Members Management                   | `5e2fec9ab34f4b38a44e2e5cdad2d859` |
| Organizer Invitation Acceptance      | `ecd8ea4b06024698a85dac216079d202` |

### Invite Organizer

![Desktop draft](https://lh3.googleusercontent.com/aida/AEtjO1WSsvzaypcBYII7nayxxFRdZbmq3t3DQHaIMmXjLnCaSNRtUMKTCOn6pnOo0YrND9lDFEj51iiihlMIvEgM1_n4KOp6KvKp6KJwPXjj9HunP3abwNfrLbJLjiGKpNobMX71Mia6S1xJhSzGJpUd0Z9fbKUWHQmBAyhn6slJCzrWMv0seyLb3ticPQSAplVmcPxwPCf2FicsbBx8ySN7EuEX6s_--oYFzZQqwsAEa6BWfVu_Q68Xm2Ej3QeB)

### Revoke Organizer Access Confirmation

![Desktop draft](https://lh3.googleusercontent.com/aida/AEtjO1W0HeOB5-Xu6Hr2jrh2uwUpf80tuwMhJuUnHKp1p3-4Uv1a0OP5hhown3JXM4BZqgYz8rYkDcx_l9xtR2CHN5MRCtFi1hco5on68parb_M34IXtI3tw2wZ3kW81gyhuMveZdDZfXBKL32odfFFahi6ijmkiZxs225IIkhtCsC5gpQoTiIiep2_sv-d7YiKaVBlaGWvLSsAeG_KPy0tGKsge284o__eFnWsGwDtyCioVgx6fyea0SHwEdUE)

### Members Management

![Desktop draft](https://lh3.googleusercontent.com/aida/AEtjO1WJYpZ9zTLmoPNbEUlATcW9_7P3xF_NPOM9YLspKHNXeVHieI8JbH1Y4o9fGawQ5BFhNXS3zkfF1k34aFasfvXLDD7JixWF36_Fz1cuVbI5ek4lb4vrI-BftjoQBCGVCPh6ceR5Oq0sIDSbI_tuwE7oTHVxJJOZG-KCjJuB46RoXvlavcJrBYHP58YM25GcfeTVPLdD7OjtPVzGGRbiGrt59nnC5PF4guMAsL1SmmL0hRS8boY98bQe2xpd)

### Organizer Invitation Acceptance

![Desktop draft](https://lh3.googleusercontent.com/aida/AEtjO1UpNMnO7N9ckIVW4WoPdN_ZI80glAThFHZZgPU1KILaG4AJf5-ZqqhI6zjHaSgeIYB5XnZjrBbbXvdVRmypE1NMgG_Uo0qhEHtnLYpzPJQucy8KcWJMKbOfg5eVnagmgtNhrlkkfGotA1JB_e8dkyC4bibm0bWwxwEoPUoOf2ip-QubDEe_x1cdrcFHGm4dExdR5u-235EEZ4vrpQgXDm0LVXYiaaGHNHIn-DkEFknlMledmhFPLCYhEFp2)

Exported previews were visually inspected. These are static samples, not working
routes. The Members preview was regenerated and inspected with its invite and rightmost
actions visible. Mockup chrome must use the actual shared staff/auth layouts
during implementation.
Separate mobile, empty/error variants and full email/auth flows remain future work.
