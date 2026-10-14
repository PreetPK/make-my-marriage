# Event Management — list, create and edit

Updated: **14 October 2026**.

Scope: desktop event list, creation and editing for admins and organizers after wedding
onboarding. [Approved desktop design](DESIGN.md), [PRD REQ-04](../Make-My-Marriage-PRD.md),
[database reference](../Make-My-Marriage-Database-Technical-Reference.md), and
[proposed API reference](../Make-My-Marriage-API-Technical-Reference.md).

## Behavior and boundaries

`/events` lists the shared wedding's active events ordered by start time and ID.
Name search treats text literally, including regex punctuation. Lists fetch at most
21 records to display 20 with a next-page indicator; page number and search length
are bounded. These are current implementation limits, not approval of older
proposed pagination defaults or proof of the 1,000-event capacity target.

`/events/new` creates a named event with required local date/start time and venue
name/address. Optional description, arrival instructions, end date and end time
are supported. Blank end date uses the start date; an end date requires an end
time. Overnight events need an explicit later date. Dates use DD/MM/YYYY, years
1900–9999; times use HH:MM on a 24-hour clock. Names/venues allow 200 characters,
addresses/instructions 1,000, descriptions 2,000.

The displayed wedding zone is read-only. Server conversion uses that zone to
store UTC instants; list display uses the same zone. Nonexistent and repeated
daylight-saving wall times are rejected with field guidance rather than silently
shifted. Supporting explicit choices between repeated times is future work.
[Intl date/time parts](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/formatToParts).

Creation is not publication and sends no invitations. There are no guest counts,
RSVPs, cancellation/deletion, gallery settings or reminder controls. Active events
can be edited through the approved desktop form; the edit scope is described below.
The saved public homepage is unchanged.

## API, storage and concurrency

GET `/api/events?q=...&page=...` reads a list; GET `?context=1` reloads the wedding
zone/revision. POST requires strict JSON with `clientRequestId` (UUID),
`expectedWeddingRevision`, and the allowlisted `values`. Server-backed staff
membership supplies the wedding and actor. Anonymous/invalid sessions return 401;
mutations require same-origin JSON and a streamed 32 KiB body limit.
Account/authentication bodies retain their separate 8 KiB cap. The event limit
accommodates normal serialized maximum-length form fields, including multibyte
text and JSON escapes, while rejecting oversized raw/streamed requests.
Responses are no-store; provider/driver errors are not exposed.

Database, services and repository code import server-only. Reads share the existing
request-scoped wedding read; permission results are not persistently cached.
Protected pages authorize before streaming a neutral loading skeleton. Event storage
initializes validators and wedding-scoped list/request indexes on first creation,
preserving existing validators. No separate provider/dependency was introduced.

A unique wedding/request ID and normalized actor/input fingerprint make retrying
the same save return the existing ID. Reusing it for different details returns 409. The form prevents repeated clicks; after a network/503 uncertainty it retains
the same payload and request ID and freezes edits until the retry resolves.
Leaving an uncertain request advises checking the event list first. Idempotency
currently survives retries within the mounted form; it does not survive browser
reloads or closing the page.

Creation reads the wedding and inserts the event while incrementing that wedding's
revision in one transaction. Wedding Settings now also checks preference locks
inside its write transaction. Both writers touch the same wedding revision, so
first-event creation and a zone edit cannot independently win. A failed insert
rolls back the revision increment; stale forms retain their values and explicitly
load the latest settings before retrying. Expenses must use the same coordination
when implemented. [MongoDB transaction API](https://www.mongodb.com/docs/drivers/node/current/crud/transactions/).

Unsaved entries warn on ordinary same-tab navigation and refresh/close. In-page
confirmation supports Keep editing and Escape. This is not autosave; Back, logout,
session expiry or reload does not promise draft recovery.

## Verification

Local schedule/input regressions cover calendar rollover, leap rules, injected
scope/publication fields, overnight intervals, explicit zone conversion,
Melbourne DST gaps/repetitions, Lord Howe's half-hour change and Apia's skipped day.
HTTP and browser outcomes are recorded below after execution. A separate mobile
design/test pass, deployed TLS verification and capacity testing remain deferred.

### Results — 14 October 2026

- 26 local tests, ESLint, formatting, TypeScript and Webpack production build passed.
- Full HTTP/security suite passed with event checks in disposable database ev01:
  anonymous/admin/organizer access, origin/content/body limits, strict input,
  UTC/overnight persistence, DST rejection, duplicate concurrent requests, changed
  request IDs, stale revisions, literal name search, wedding scope, two-page results,
  validator failure rollback/retry and simultaneous first-event/settings writes.
  Existing authentication/session/outage and onboarding/settings checks also passed.
- Desktop browser checks at 1280px covered the empty state, first-error focus,
  Keep editing/Escape, creation, overnight display, refresh persistence, search/no
  matches, the settings zone lock, stale settings reload retaining entries, actual
  validator failure and same-request retry. Both browser events persisted once.
  Sign-out → Back and direct /events/new stayed at login. No console errors were
  recorded in the final browser check; no horizontal overflow in the list.
- Browser verification found a post-save router push/refresh race after a successful
  save. It was fixed by replacing the form with a fresh list document; lint/build
  and the relevant browser flow were repeated successfully. The full HTTP suite
  preceded this client-only navigation adjustment; backend code did not change.
- The three disposable databases were removed; their absence was independently
  checked. No application database, local credentials, service setup or dependencies
  changed. Mobile, production TLS/abuse testing and capacity checks remain deferred.

Changes are local, uncommitted and unpushed.

## Event editing — 14 October 2026

`/events/{eventId}/edit` loads saved event details in the wedding time zone. The
list now has an Edit action for each active event. Create and Edit reuse one form;
Save changes is disabled until values change. Both names and schedules/venues
remain editable by current admins and organizers. Clearing description, arrival
instructions or the optional end removes the stored optional values.

GET `/api/events/{eventId}` returns only editable detail fields, event revision and
wedding-zone context. PATCH accepts a strict full form with `clientRequestId`,
`expectedRevision` and `values`. IDs must be 24 hexadecimal characters. Missing,
foreign-wedding and non-active records return the same 404 after authorization.
Client scope, roles, lifecycle, visibility, gallery and reminder fields are rejected.

Saving uses one atomic wedding-scoped active-event update filtered by the expected
event revision. Existing events already lock the wedding time zone; editing does
not bump the wedding revision or serialize edits to different events. Writes use
nested allowlisted fields, preserve create identity/audit data and unrelated event
content, and add current update audit fields. Attendance and photo records are not
rewritten. No publication, notifications, archive or delete operation is added.

The event retains the last edit request ID and a fingerprint of normalized values,
actor and expected revision. Repeating that latest save returns its result without
another revision increment. Different details with the same retained ID conflict;
a request older than a later edit also conflicts through its old revision. This is
last-save retry support, not an indefinitely retained history of every request.

A stale save retains the draft and blocks further saves until the latest event is
loaded. Loading asks before replacing dirty entries, supports Keep editing/Escape,
and leaves entries intact if loading fails. After an uncertain network/503 response,
inputs freeze and Retry same request keeps the payload/revision/ID unchanged. A
successful save replaces the form with a fresh event list. Session loss redirects
through the existing authentication guard. Draft persistence across reload, logout
or browser history remains outside this scope.

### Focused test command

```sh
ACCOUNT_TEST_DATABASE=mmm_account_test_unique_name ACCOUNT_TEST_EVENTS_ONLY=1 npm run test:http
```

Use a new disposable name matching the harness guard and no more than 38 bytes;
never select the application database. This mode seeds fictional staff/onboarding,
runs create/edit HTTP checks, and deletes its database in finally. Add
`ACCOUNT_TEST_BROWSER=1` in an interactive terminal to hold the fixture for browser
checks, then press Enter for cleanup. It skips unrelated authentication-suite and
page-timing runs; the normal full suite also includes these event checks.

### Edit verification results

- 27 local tests, lint, formatting, TypeScript and Webpack build passed.
- Focused create/edit HTTP suite passed in the disposable ed01 database. New
  checks include populated read, admin/organizer edits, missing/foreign/non-active
  IDs, anonymous/forged/bearer-only/revoked/stale-version sessions, mutation transport
  limits and injection, concurrent same/different requests, UTC edits, optional
  clearing, preserved creation metadata/nested extras/invitation associations, and
  actual validator failure/retry with an unchanged event revision on failure.
- Desktop browser checks passed for creation through the shared form, Edit entry,
  disabled unchanged save, invalid calendar focus, unsaved navigation/Escape,
  save/reopen/refresh, optional clearing/re-adding, two-tab conflict retention,
  Keep editing and confirmed replacement with latest details, failed save and retry.
  The retry applied once at revision 4, with one event record and cleared fields.
  The edit screen fit the desktop viewport without horizontal overflow; no console
  errors were recorded. Sign-out → Back and direct edit access returned to login.
- Fixture cleanup was independently confirmed; the temporary validator backup
  was removed. Only disposable fictional data was written. No mobile pass or
  deployment was performed. The earlier full authentication HTTP suite was not
  repeated in this focused run; shared authorization code was unchanged.

## Request-size regression fix — 14 October 2026

The review's multibyte request rejection is fixed with EVENT_REQUEST_BODY_LIMIT
(32,768 bytes) shared by create/edit routes. readRequestBody counts actual streamed
bytes, checks declared length, cancels oversized streams and sanitizes stream
failures. readAccountBody remains an 8,192-byte wrapper for existing callers.

29 local tests and the focused Events HTTP suite passed. Tests accept schema-valid
CJK fields above 8 KiB and maximum-length six-byte JSON-escaped fields (over 26 KB)
on POST/PATCH; verify persistence, exact reader boundary, false/missing length
headers and stream cancellation; reject declared/chunked event bodies above 32 KiB;
and retain account signup's 8 KiB rejection. Lint, formatting, types and Webpack
build passed. The disposable sz01 database was removed and its absence checked.
No UI/browser change, installation, deployment, commit or push was performed.
