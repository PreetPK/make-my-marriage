# Wedding Settings

Updated: **13 October 2026**.
Scope: admin editing of the one completed wedding. The user approved the desktop
Stitch design and the preference-lock rules; a separate mobile design is deferred.

References: [PRD REQ-03](Make-My-Marriage-PRD.md),
[database reference](Make-My-Marriage-Database-Technical-Reference.md),
[API reference](Make-My-Marriage-API-Technical-Reference.md),
[onboarding](wedding-onboarding/Implementation.md).
The user-approved optional date/venue and public-admin rules supersede older documents.

## Design

[Stitch project](https://stitch.withgoogle.com/projects/12751053601206958162).
Approved desktop screen: `3c9166f6bf5643baaad8a00ab2b8dde7`.
Playfair Display headings and Plus Jakarta Sans controls retain the blush/plum
identity. The staff layout owns a 240px sidebar with Dashboard and Wedding Settings;
organizers see Dashboard only. Three sections use fine dividers rather than cards:
Couple details, Venue, Wedding preferences. Save/Discard follow the form without
covering fields. The normal layout stacks on narrow screens without a separate
mobile design. No unavailable feature links are shown.

## Working behavior

`/wedding-settings` loads saved names, optional local wedding date, optional venue,
time zone and currency. It is available only to current admins after onboarding.
Names are required; existing onboarding validation/choice lists are reused. Date
uses DD/MM/YYYY and real calendar validation; it stores YYYY-MM-DD without an
instant/time-zone conversion. Undecided date removes the stored date; undecided
venue clears name/address while preserving unrelated venue content.

The form disables Save until changed, disables edits during saves, reports success,
keeps inputs on failure, and offers retry. In-page confirmation prompts support cancel/Escape. Discard confirms before restoring the
last loaded/saved values. Reload/close and ordinary same-tab navigation links warn
about unsaved edits; this is not autosave and does not promise drafts survive
browser Back, session expiry, or sign-out. A stale save retains edits and offers
explicit Load latest saved details, with a replacement warning.

All admins share settings. Changes appear on the dashboard after navigation/reload.
Saving does not change setup completion/status or publish/connect the guest homepage.
Story, photos, publication, guest access and rescheduling/conversion remain separate.

## API and storage

GET and PATCH `/api/wedding/settings` check current database-backed staff membership
and admin role; no-store responses. PATCH requires same-origin JSON, a streamed
8 KiB limit and strict input:

```json
{
  "expectedRevision": 4,
  "values": {
    "couple": {
      "brideName": "Asha",
      "groomName": "Dev",
      "weddingDate": "29/02/2028",
      "dateUndecided": false
    },
    "venue": { "venueName": "", "venueAddress": "", "venueUndecided": true },
    "preferences": { "timeZone": "Australia/Melbourne", "currency": "AUD" }
  }
}
```

The server derives wedding/actor IDs; client roles, scope, status, publication and
completion fields are rejected. It changes only allowlisted nested fields and
server-derived currency minor units; other content survives. One atomic
membership-scoped active-wedding revision update prevents stale overwrites.
There is no upsert or second wedding. Existing wedding validator/index initialization
and the saved-state mapper are reused from onboarding.

Approved rule: time zone locks once any wedding event exists; currency locks once
any wedding expense exists, including archived records. UI and API enforce locks;
unrelated records for another wedding do not lock this wedding. GET includes lock
flags. No conversion or rescheduling happens. Future event/expense writers must
coordinate creation and preference updates using the wedding revision/transaction
so a record cannot appear between the settings check and save. Event creation now shares wedding revision/transaction coordination, and Settings
rechecks locks in its transaction snapshot; see [event implementation](events/Implementation.md).
The expense writer remains future work and must coordinate the currency lock too.

Errors: 400 invalid input, 401 signed out, 403 access/origin, 409 stale/locked/setup
required, 413 body too large, 415 wrong media type, sanitized 503 unavailable.

## Verification

Verification results are recorded in [project progress](Project-Progress.md).
For current request-scoped read sharing, loading feedback and before/after timings,
see [performance](Performance.md). Local tests: `npm test`. Settings HTTP cases run inside the existing guarded
`npm run test:http` disposable-database suite; see [authentication coverage](Authentication-Test-Coverage.md).
No provider packages, secrets or new environment variables are required.
