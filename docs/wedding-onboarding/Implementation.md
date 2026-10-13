# Wedding onboarding — implemented flow

Updated: **12 October 2026**. Visual reference: [design brief](DESIGN.md).
Requirements: [PRD REQ-03](../Make-My-Marriage-PRD.md),
[wedding database definition](../Make-My-Marriage-Database-Technical-Reference.md),
and [API reference](../Make-My-Marriage-API-Technical-Reference.md).
The user-approved optional date/venue and public-admin account rules supersede
older requirements. No wedding time zone or currency is inferred automatically.

## Working behavior

Admins sign in and are routed to /onboarding until the **one shared wedding** is
configured. The three steps are Couple details, Wedding settings, and Venue.
Continue saves each of the first two steps; refresh resumes saved progress.
Back preserves in-memory drafts, including entries in later steps. Unsubmitted
changes are not autosaved and will be lost on reload/navigation.

Names are required and bounded to 200 characters. The optional date is entered
as day/month/year and validated as a real Gregorian calendar date, including
leap years. It is stored as a local YYYY-MM-DD string, without a machine time-zone
conversion; empty/undecided dates remove the field. Wedding settings require an
explicit validated IANA zone and a runtime-supported currency code. Server-side
Intl currency metadata supplies currencyMinorUnit; no exchange rates are used.
Client validation uses the server-supplied selection lists, so different browser
ICU versions cannot reject an offered option. The server still validates every
zone/currency on writes. Venue name/address are optional, bounded to 200/1,000 characters, and ignored when
undecided. Fields retain draft text when an undecided checkbox is toggled back.

Finish setup saves the venue if provided, activates the workspace and records
onboarding.completedAt, then replaces the current browser entry with /dashboard.
The dashboard shows saved details. Completed weddings skip onboarding for all
admins, including new accounts. The wizard cannot overwrite a completed wedding.
Completing setup does not publish the guest website or change homepage sample data.

## Authorization, storage, and conflicts

Every page and mutation checks the current database-backed staff identity. Only
admins can save setup; organizers cannot access the wizard or mutation. Anonymous
page requests go to login, and the API returns 401. Shared connections and auth
remain in src/server; business logic and the repository stay in this feature’s
server directory and import server-only.

PATCH /api/wedding/onboarding requires configured same-origin JSON, an actual
8 KiB body limit, and a strict body containing step, expectedRevision, and values.
The server derives the wedding ID and actor from membership; IDs, roles, status,
and completion timestamps are never accepted from the browser. Responses are
no-store; invalid inputs return 400, unauthorized roles/origins 403, unsupported
media 415, large bodies 413, and sanitized storage failures 503.

The first save adds bounded wedding-field validation and ensures the unique
singleton index. Existing validators are retained as additional constraints.
Each write scopes the existing singleton by membership, setup status and revision,
then updates that one document atomically and increments its revision. No new
wedding, transaction spanning collections, provider SDK, or setup command is needed.

Stale revisions return 409 without a partial update. The form retains entries
and offers Load latest saved details, explicitly warning that reload replaces
them with the shared record. Pending saves disable repeat submission and Back.
Storage/network failures keep entered values and offer retry; if a previous
request actually committed, its old revision cannot overwrite the shared record.
Completed setup returns SETUP_COMPLETE on replay and the UI returns to dashboard.
Expired/revoked sessions return to login rather than continuing an unauthorized save.

## Source files

- [Protected route](<../../src/app/(onboarding)/onboarding/page.tsx>).
- [Thin API handler](../../src/app/api/wedding/onboarding/route.ts).
- [Three-step form](../../src/features/wedding-onboarding/components/onboarding-form.tsx).
- [Setup shell](../../src/features/wedding-onboarding/components/onboarding-shell.tsx).
- [Browser-safe schemas](../../src/features/wedding-onboarding/schemas.ts).
- [Service](../../src/features/wedding-onboarding/server/service.ts) and
  [repository](../../src/features/wedding-onboarding/server/repository.ts).
- [Local tests](../../tests/wedding-onboarding.test.ts) and
  [HTTP checks](../../tests/wedding-onboarding.http.mjs).

## Verification — 12 October 2026

- All 17 local regressions passed, including calendar dates, Unicode names, explicit
  settings, venue bounds/undecided behavior, safe revisions, injected fields, and
  a browser/server ICU compatibility regression.
- Lint, formatting, TypeScript and npm run build -- --webpack passed. The default
  Turbopack build was not used for this validation. No dependencies were installed.
- The complete existing authentication/security HTTP suite passed with the new
  onboarding checks. Real Atlas assertions cover transport/auth rejection,
  premature completion, invalid dates/zones/currencies, organizer denial,
  two admins saving the same revision, saved-step resume, shared membership,
  JPY/KWD/INR minor units, optional date/venue, collection validation, concurrent
  completion, replay protection and no publication side effect.
- In-app Chromium passed signup/login → automatic onboarding → all steps → dashboard,
  refresh resume, settings required-field focus, Back retaining later selections
  and venue drafts, a stale second-tab save with retained input and explicit reload,
  completed-wizard redirects/history, logout denial, and a later admin skipping
  setup while seeing the same saved wedding.
- Settings and venue fit a 320px viewport; venue and its save-error state fit 390px
  without horizontal overflow. Desktop composition was inspected. Earlier Step 1
  mobile/name/date checks remain recorded in project progress. No real phone
  keyboard, cross-browser, or complete accessibility audit was performed.
- A temporary write-rejection validator in the browser-only fixture caused an
  actual failed final save. The UI retained editable entries; MongoDB stayed in
  setup at the same revision. Restoring its original validator allowed retry to
  complete exactly once. Final readback confirmed the correct fields, one wedding,
  both fictional admins’ membership, and no publication change.
- The HTTP and browser fixtures used mmm_account_test_20261012_ob02 and
  mmm_account_test_20261012_ob03. Both were removed and separately verified to have
  no collections. An initial overly long test name was rejected before any writes;
  the fixture now checks its conservative 38-byte Atlas name limit up front.
  Application data, local credentials, and email delivery were untouched.

Run npm test for local checks. For opt-in remote checks, build current code and
run npm run test:http with ACCOUNT_TEST_DATABASE set to a new disposable name
starting mmm_account_test_ (at most 38 bytes). Nonempty/application databases are
refused. ACCOUNT_TEST_BROWSER_ONLY=1 starts only the manual-browser fixture and
pauses until Enter; it does not execute the automated HTTP assertions. See
[authentication coverage](../Authentication-Test-Coverage.md) for wider limits.

## Remaining scope

Editing a completed wedding needs a separate settings feature, with the documented
currency/time-zone restrictions once expenses or scheduled events exist. Website
story/photos/content editing, real guest website access/publication, homepage data
connection, events, and production deployment/load checks remain separate work.
No rollout, commit or push was performed by implementing this feature.
