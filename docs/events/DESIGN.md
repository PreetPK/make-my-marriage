# Design System: Make My Marriage — Event Management

## Visual atmosphere

A calm wedding planning workspace; balanced density, clear rows and generous form spacing. Desktop only for this review. Match approved Wedding Settings screen 3c9166f6bf5643baaad8a00ab2b8dde7.

## Palette

Blush #FEF8F5 canvas; white surfaces; plum #301621 primary buttons and active navigation; charcoal #1D1B19 text; warm brown #705A45 secondary text; bronze #99816A restrained decorative detail. No gradients or neon.

## Typography

User-approved Playfair Display headings and Plus Jakarta Sans controls/body. Preserve established brand despite generic dashboard typography defaults. Heading 32px, body 14–16px, label 14px.

## Components

240px staff sidebar: Dashboard, Events (active), Wedding Settings, bottom Sign out. Organizer variant omits Wedding Settings. Flat plum primary button, outlined secondary, 44px hit targets, clear focus. Labels above inputs, errors below. Real data tables, no decorative KPI cards. Layout-matching skeleton while loading.

## Layout

1440px desktop canvas, main content max 1100px, 40–48px padding. Left-aligned title and single primary action. Table rows separated by subtle warm rules. Create/edit are dedicated pages with max 800px form; two-column date/time fields.

## Interaction

Minimal opacity/transform feedback, reduced-motion support. No perpetual animation on settled content. Unsaved changes confirmation, disabled saving, retry retaining entries, stale-change warning with explicit load latest. No destructive controls in this phase.

## Anti-patterns

No emoji, stock photo hero, fake guest/RSVP metrics, charts, neon, card grids, speculative integrations, publication controls, cancel/archive/delete, or mobile screens.

## Feature boundaries

Admins and organizers manage event content. Required event name, date, start time, venue name/address; optional end time, description/guest instructions. Explicit read-only wedding zone Australia/Melbourne in samples. Optional end date supports overnight events. Date format DD/MM/YYYY and 24-hour time. Saving does not publish or send emails. Samples are fictional. Search and pagination for the list; exact page-size defaults remain unapproved.

## Review status and references

Desktop design approved on 14 October 2026. List, creation and editing are implemented from these desktop references.
See [implementation scope](Implementation.md).

[Stitch project](https://stitch.withgoogle.com/projects/12751053601206958162).
Relevant requirements: [PRD REQ-04](../Make-My-Marriage-PRD.md),
[database event reference](../Make-My-Marriage-Database-Technical-Reference.md),
[proposed API reference](../Make-My-Marriage-API-Technical-Reference.md), and
[approved wedding preference locks](../Wedding-Settings.md).

## Implementation notes and open decisions

- Current page sizes and text bounds are documented in [implementation scope](Implementation.md); older proposed defaults are not treated as approved.
- Conversion rejects ambiguous/nonexistent daylight-saving times and stores UTC instants derived from the saved wedding zone.
- Creation and Wedding Settings saves share wedding revision/transaction coordination.
- Publication is admin-only under the PRD; the proposed organizer API conflicts.
  No publication control is included in this first phase.
- Cancellation/archive effects on invitations, RSVPs and photos require a separate
  decision before lifecycle controls are introduced.

## Desktop screen references

| Screen                             | Stitch screen ID                   |
| ---------------------------------- | ---------------------------------- |
| Events List                        | `b7433fe22d8b4ff182e1090d24511c8b` |
| Edit Event (Staff Shell)           | `d59f4fc3add642d4ad14cb92403b8b04` |
| Create Event (Staff Shell)         | `40dbaa2f2df742f085e5cf706fb7e754` |
| Events (Empty State) (Staff Shell) | `2825a531290b4808b6c57556917d7746` |

Exported screenshots were visually inspected. No mobile screens were requested.
These are approved static mockups. See the implementation guide for working list/create behavior and checks; editing uses the shared event form.

### Events List

![Desktop design preview](https://lh3.googleusercontent.com/aida/AEtjO1XQnRWYqZEBVPfqsN4cTxlnXT33TH8uWUH_TeNMSNNQGEstAfl2gLJNAf6jRcJFPF0wkv0dS5qK446hkULNHTLMTmk-sDcduzj0U4sCKvt6QRVzI-tOh0EtZhegXOAUDx-CShUUietbWIHcJVSb9pMe3FPkfCH3proGay8uH6Fc0bKCgdLziutCxqmB4sUpMu1dXiaMWIxsuXzxF76GSUx0NZbZXukAWQ9oHGl4Xk_ajLVtCdMz1qDlCnZT)

### Edit Event (Staff Shell)

![Desktop design preview](https://lh3.googleusercontent.com/aida/AEtjO1WMczUpZrEPP8Osd6P525wiMbraFhoOzQtLbs9HeKiwc8vQPk_AUaCk_chOOsgav2TigTayZzG25xZZkcDT0tMMkJ_ufOyfqH6UZky3d1Zs0d6fZWsqxOLcYBQkbiFaR1oDljD9r8ib_C7Xt1FnJWMpuPfnIP_YVDtnzVK7NUHMizfelkp5k0d0Cz6txPIpebLW_xFmMt2BfAKt8Ph2ERSAtyeXj7NuibGzBBYsiaFt-WXF6PwvEzWR9782)

### Create Event (Staff Shell)

![Desktop design preview](https://lh3.googleusercontent.com/aida/AEtjO1Wskg3FfvPLWtH16dSC7MHekkLw-M80HAS_4nSncHt65LHRws7Yfz-sVpNJrB_zs_nMRxYN9VXC3occlgPsxBVuEGFl4cxY5HGI2STdHc7etWSdwcuUO3EoYj8hzgsJBG0MRlvjAZFo5Lfwmou0YuZ3YeHlL2tj42CXeySuaKMYoSbtsl5Ql3rZTK1qW2DEyP-5aqn7pWfg9A1O-mqKxqwaWSlO0nAC5g3qZH_cUrt7e2MHMvCUMcP4CIgp)

### Events (Empty State) (Staff Shell)

![Desktop design preview](https://lh3.googleusercontent.com/aida/AEtjO1Wdl2-2-NuNA6yTYH-bTDB5uQQZUlWjJEQdkGPb-0aVKihLv8QQEgarrbOe3XzVQarSMIFwokS_rvJ1-q7Wd5S5XQzBqmjf_uxy7qYQcFSxnDEC-DW4BFjtxOpmVT3goOFxAwHSS1DlEiszs8hxa8mhUs3OLKpRJiJBmFoBENPR7i4lyV2ln6W5X3TlCy4M_zx-1KOYvlEtVPeuSAqM5N5HYSienjWhhiKBwiO2qaJ3ZWP7mb_xpAAZVdU)
