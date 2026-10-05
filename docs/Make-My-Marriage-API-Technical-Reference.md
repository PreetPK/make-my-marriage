# Make My Marriage

## API Technical Reference

**Version:** 1.1  
**Date:** 24 September 2026  
**Status:** Proposed implementation contract; not implemented or tested  
**Inputs:** PRD v1.4, architecture v1.1, database design v1.2 including the API addendum  
**Reader guide:** [Plain-language API design](Make-My-Marriage-API-Design.md)  
**Full payloads:** [All 76 endpoint examples](#13-complete-endpoint-examples) · [Authentication, webhooks, jobs, and R2](#14-library-and-provider-interfaces)  

## 1. Transport and conventions

Use same-origin JSON HTTP routes under `/api/v1`, implemented inside the Next.js/Node.js modular monolith. Route handlers call application services; server-rendered pages may call the same services without a loopback HTTP request. Authorization applies equally to both paths. No separate backend deployment is implied.

Auth.js owns `/api/auth/*`; Inngest owns its SDK handler at `/api/inngest`; Resend callbacks use `/api/webhooks/resend`. Their protocols do not use our JSON envelope. Direct R2 PUT/GET requests are also outside it.

| Convention | Contract |
| --- | --- |
| JSON input | `Content-Type: application/json`; reject malformed JSON and unknown writable fields using strict Zod schemas |
| IDs | Expose MongoDB ObjectIds as 24-character hexadecimal strings named `id`; opaque fixture IDs only where explicitly documented |
| Wedding scope | Resolve the single wedding on the server; do not accept client-controlled `weddingId` or arbitrary ownership fields |
| Dates | UTC ISO-8601 response timestamps; local date `YYYY-MM-DD`; time zone uses an IANA name |
| Money | Decimal integer strings in minor units, e.g. `"125050"`; currency and minor-unit count accompany responses; no float calculations |
| Common record fields | `id`, `revision`, `createdAt`, `updatedAt`; responses include only role-appropriate fields |
| Pagination | `limit=50` default, maximum 100; opaque `cursor`; `{items, nextCursor}` where final cursor is null |
| Cursor binding | Bind cursor to route, scope, sort, and filters; reject reuse with changed filters; deterministic ID tie-breaker |
| Body limits | Proposed 256 KiB for application JSON; uploads carry metadata only; reject oversized body with 413 |
| Text bounds | Names 200, descriptions 10,000, notes 2,000, search 100 characters; email validation and normalization follow the database design |
| Null semantics | PATCH omits unchanged fields; null clears only documented optional fields; never null a required field |
| Request correlation | Return `X-Request-ID` and `meta.requestId`; log IDs and safe error codes, not credentials or personal links |
| Cache policy | Sensitive responses/pages, link/QR responses, and errors: `Cache-Control: private, no-store`; `Referrer-Policy: no-referrer` |

Default sorts: events by `(startsAt,id)` ascending; guests by normalized display name plus ID; invitation lists by ID; photo/history/expense lists by `(createdAt,id)` descending; planner fixtures by name plus fixture ID. Changing data can move between list pages; pagination is not a frozen export. `q` uses literal, escaped text search without user-supplied regex; define normalization consistently and validate query plans. Allowed list filters appear in the route tables; arbitrary MongoDB filters, field projections, and sorting expressions are rejected.

Single-record success:

```json
{
  "data": {
    "id": "660000000000000000000003",
    "status": "attending",
    "revision": 4,
    "respondedAt": "2026-09-24T08:30:00.000Z"
  },
  "meta": { "requestId": "req_example" }
}
```

List success:

```json
{
  "data": { "items": [], "nextCursor": null },
  "meta": { "requestId": "req_example" }
}
```

Error:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please check the highlighted fields.",
    "fields": [{ "path": "email", "message": "Enter a valid email address." }]
  },
  "meta": { "requestId": "req_example" }
}
```

| HTTP status | Meaning / representative code |
| --- | --- |
| 200 / 201 | Saved/read successfully / created; 201 includes Location when a caller-readable resource exists when a caller-readable resource exists |
| 202 | Work durably accepted, not finished; Location points to a caller-readable status resource when exposed; neutral/private account responses omit it |
| 204 | Successful removal/revocation with no response body |
| 400 / 422 | Malformed syntax or cursor / well-formed input failing field or business validation |
| 401 / 403 | Missing/invalid authentication or link / authenticated role lacks permission |
| 404 | Record absent or outside a valid guest capability; do not reveal another guest's records |
| 409 | `REVISION_CONFLICT`, `IDEMPOTENCY_CONFLICT`, `ACCESS_CONTEXT_CHANGED`, or incompatible lifecycle state |
| 413 / 415 | Request too large / unsupported content type |
| 429 | Rate limit; include Retry-After |
| 500 / 503 | Unexpected error / unavailable dependency before durable acceptance; no raw provider or database details |

Every route inherits these errors. An inaccessible guest record returns 404 after authenticating the capability, even if its ID exists. Invalid/expired/revoked sharing credentials use one neutral `LINK_UNAVAILABLE` error, without disclosing which condition applied.

## 2. Authentication, capabilities, and request protection

### Staff

Use Auth.js credentials login/logout helpers and native handlers, not invented `/v1/login` endpoints. Custom account routes below implement persistence and recovery. Auth.js Credentials does not automatically supply account persistence or recovery. Validate the selected package version and session behavior before implementation. [Auth.js Credentials](https://authjs.dev/getting-started/authentication/credentials)

Require an active verified user, current wedding membership, and matching `sessionVersion` on every protected request. Password reset and membership revocation invalidate old versions. Roles are server-assigned; access changes are checked again before background side effects. Never return password hashes, token verifiers, encrypted token material, or internal session claims.

### Guest links

Proposed page addresses use a URL fragment: `/invite#token=...`, `/wedding#token=...`, `/gallery?eventId=...#token=...`. The page posts the token once to `/access/exchange`, clears the fragment from browser history, and keeps the returned non-secret `contextId` in tab-scoped sessionStorage so refresh can resume the same context. Do not store raw tokens in localStorage, sessionStorage, or analytics. Disable email click tracking for secret-bearing invitation/recovery links. Confirm fragment preservation in supported email clients during validation.

The exchange sets a signed/encrypted Secure, HttpOnly, SameSite=Lax cookie containing link ID, generation, expiry, and recovery epoch. Use separate scope cookies restricted to `/api/v1/guest`, `/api/v1/website`, and `/api/v1/gallery`; proposed browser validity is 12 hours, after which the original active link can be opened again. Cookie expiry does not expire the shared link itself.

Every guest request checks the source link's current active state/generation, recovery epoch, and relevant guest/event states. Require `X-Access-Context: <contextId>` matching the cookie. Opening another person's link in a second tab must yield `409 ACCESS_CONTEXT_CHANGED` in the first tab instead of silently showing or changing the other guest's data. A link is a bearer permission, not proof of guest identity. Staff sessions cannot implicitly substitute for personal invitation capabilities.

Gallery routes accept either authenticated staff or a gallery capability; website routes accept staff or a wedding capability. Guest invitation routes accept only personal capabilities. Explicit server-generated gallery links may be included in wedding/personal responses as agreed; never include any other guest's personal link.

### Browser mutations and abuse controls

`GET /security/csrf` sets a signed host-only CSRF cookie and returns `{csrfToken}`. Application POST/PATCH/DELETE requests require its matching `X-CSRF-Token`, JSON content type, and an exact allowed Origin check, including anonymous account and exchange routes. GET/HEAD never send email, consume recovery tokens, save RSVPs, or change access. Auth.js retains its own protections; signed provider endpoints use signature verification instead of browser CSRF. No wildcard credentialed CORS.

Apply a shared rate limiter across serverless instances, not an in-memory per-instance counter. Proposed initial limits: login 10 attempts/15 minutes per account and 60/IP; recovery/verification email requests 3/hour per normalized address and 20/IP; exchange 30/minute/IP; guest writes 60/minute/capability; upload initiation 20 files/request and 60 files/hour/capability. Combine key and IP limits, redact keys in logs, allow configuration after load testing, and account for shared wedding Wi-Fi. Rate-limiter backing service remains an implementation decision. Provider-wide quotas are enforced separately.

## 3. Revisions, retries, and response projections

Mutable record PATCH bodies require `expectedRevision`. DELETE and the lifecycle POST routes explicitly marked in the catalog use `If-Match: "<revision>"`; missing required preconditions return 422. An outdated revision returns 409 without a partial write. For initial creates no revision is required. GET/detail/write responses include current revision; an ETag with the same value may also be returned.

Require `Idempotency-Key` on email sends/retries, staff invitation emails, assignment operations, and upload-initiation requests. Keys are random client-generated values reused for retries of the same intent. Store key + canonical request hash + actor/wedding scope with the domain operation; reuse with different input returns 409. Check current authorization before returning a remembered result. A new key means an explicitly new action. Password-reset/verification consumption is already single-use; return neutral token-unavailable behavior on repeat, never issue a second side effect.

Gallery upload retries are additionally deduplicated by `(selectionId,clientFileId)`. Safe CRUD create retries use a proposed `clientRequestId` field and unique scoped index on events/guests/expenses; this field is internal and omitted from normal responses. Do not implement generic infinite duplicate response caching. Proposed request identity retention is the lifetime of the associated record/operation; any later cleanup must preserve the agreed retry window and required history.

Projection names used below:

| Projection | Returned fields |
| --- | --- |
| EventStaff | Common fields, name, startsAt, endsAt, venue, description, visibility, status, RSVP deadline and reminderEnabled, gallery upload setting |
| EventGuest | ID/revision, name, startsAt, endsAt, venue, description, RSVP deadline; only authorized event details |
| GuestStaff | Common fields, name, email, status; no link token unless dedicated copy route |
| Invitation | ID/revision, eventId, guestId for staff only, assignmentStatus, RSVP status/respondedAt; guest response omits staff attribution |
| Photo | ID/revision, eventId, status, processingStatus, width/height, safe display name, createdAt, temporary preview/thumbnail URLs and expiry; no original storage key or uploader identity |
| Expense | Common fields, description/category, eventId, currency, currencyMinorUnit, costMinor, paidMinor, outstandingMinor, derived paymentStatus, notes |
| Staff | ID/revision, name, email, role, status, emailVerifiedAt; no credential fields |
| Operation | ID, kind/status, createdAt, counts, safe error codes, statusUrl; no provider keys or message bodies |

`Photo` for accepted gallery assets includes expiring preview URLs; original download requires a separate authorized call. GET status may report deleted to an admin or the initiating uploader; shared photo listings exclude non-accepted/deleting/deleted records.

## 4. Account and staff endpoints

Routes in all following tables use `/api/v1` unless an absolute route is shown. A = admin; S = admin or organizer; Link = stated capability; Anonymous means no staff login but still CSRF/rate checks for mutations.

| Method and route | Access | Input | Success |
| --- | --- | --- | --- |
| GET `/security/csrf` | Anonymous | None | 200 csrfToken |
| POST `/account/signup` | Staff invite token | inviteToken, name, email, password, passwordConfirmation | 201 `{state:"verification_required"}`; consumes invite, queues verification |
| POST `/account/verify-email` | Verification token | token | 200 `{state:"verified"}`; no automatic login |
| POST `/account/resend-verification` | Anonymous | email | 202 neutral `{message}` whether eligible or not |
| POST `/account/forgot-password` | Anonymous | email | 202 neutral `{message}` whether eligible or not |
| POST `/account/reset-password` | Reset token | token, password, passwordConfirmation | 200 `{state:"password_reset",requiresLogin:true}` |
| GET `/me` | S | None | 200 Staff plus effective permissions and wedding time zone/currency |
| GET `/staff` | A | status, pagination | 200 Staff list |
| POST `/staff/invitations` | A | email; Idempotency-Key | 202 `{userId,operationId}`; role fixed to organizer |
| POST `/staff/{userId}/invitation-resends` | A | If-Match; Idempotency-Key | 202 `{userId,operationId}`; replaces pending invite token |
| DELETE `/staff/{userId}/access` | A | If-Match | 204; organizer only, increments session version |

Sign-up email must match the preauthorized invitation. Proposed password length: 12–128 characters with confirmation; final hashing and Unicode handling to be validated. Do not silently trim passwords. Neutral recovery responses must not reveal whether an address is staff or guest. Duplicate recovery clicks are throttled; replacing an active challenge invalidates prior pending challenge delivery safely. Bootstrap supplies the two admin invitations; no public admin-creation route. Revoked organizers may be re-invited only through an explicit admin invitation, never via password reset. Admin records cannot be revoked using organizer endpoints.

## 5. Wedding, events, and dashboard

| Method and route | Access | Input | Success |
| --- | --- | --- | --- |
| GET `/wedding` | A | None | 200 editable wedding content/settings, revision |
| PATCH `/wedding` | A | expectedRevision; couple names, weddingDate, timeZone, currency, website story/venue/imageAssetIds, youtubeVideoId | 200 updated wedding |
| GET `/reminder-settings` | A | None | 200 enabled, leadDays=7, localRunTime, revision |
| PATCH `/reminder-settings` | A | expectedRevision, enabled; localRunTime proposed configurable | 200 settings; leadDays fixed at 7 |
| GET `/dashboard` | S | None | 200 uniqueGuests, activeEvents, invitation/RSVP totals; expense summary omitted entirely for organizer |
| GET `/dashboard/events` | S | status, pagination | 200 paginated event RSVP counts |
| GET `/events` | S | q, status, from, to, pagination | 200 EventStaff list |
| POST `/events` | S | clientRequestId, name, startsAt, endsAt?, venue, description?, visibility?, deadlineLocalDate? | 201 EventStaff; reminders disabled by default |
| GET `/events/{eventId}` | S | None | 200 EventStaff |
| PATCH `/events/{eventId}` | S | expectedRevision and allowed event content fields | 200 EventStaff |
| POST `/events/{eventId}/cancel` | S | If-Match | 200 cancelled EventStaff |
| POST `/events/{eventId}/archive` | S | If-Match | 200 archived EventStaff |
| PATCH `/events/{eventId}/reminder-settings` | A | expectedRevision, enabled | 200 EventStaff |

Event create/edit timestamps require an explicit UTC offset; convert to UTC and display in wedding time zone. Deadline is a local calendar date interpreted as end of that day; reject if after event start. Null removes the deadline only when reminders are disabled. Organizer event-edit fields cannot change reminder enablement, upload availability, or general wedding settings; admins may patch `gallery.acceptUploads`. Validate `endsAt >= startsAt`. Time-zone edits require a reviewed rescheduling process before live use; initially reject zone changes once scheduled events exist with `409 RESCHEDULE_REQUIRED`. Currency cannot change after expenses exist. This conservative API proposal narrows the earlier database rescheduling option.

Cancellation/archive stops active event invitations, RSVP writes, and scheduled sends; preserves history and photos. Proposed album browsing remains available, but new uploads stop. No hard-delete event route or automatic restore is introduced. Counts use active guests/events and invited assignments; aggregate in the database. If future cached counts are used, return `asOf` and document freshness first.

## 6. Guests, assignments, and RSVP management

| Method and route | Access | Input | Success |
| --- | --- | --- | --- |
| GET `/guests` | S | q, status, pagination | 200 GuestStaff list |
| POST `/guests` | S | clientRequestId, name, email, duplicateEmailAcknowledged? | 201 GuestStaff |
| GET `/guests/{guestId}` | S | None | 200 GuestStaff |
| PATCH `/guests/{guestId}` | S | expectedRevision, name?, email?, duplicateEmailAcknowledged? | 200 GuestStaff |
| DELETE `/guests/{guestId}` | S | If-Match | 204; soft removal, stops personal access |
| GET `/guests/{guestId}/invitations` | S | assignmentStatus, pagination | 200 Invitation list with authorized event summaries |
| GET `/events/{eventId}/invitations` | S | assignmentStatus, rsvpStatus, pagination | 200 Invitation list with guest name/email |
| POST `/assignment-operations` | S | distinct guestIds[1..1000], distinct eventIds[1..1000]; Idempotency-Key | 202 assignment Operation |
| GET `/assignment-operations/{operationId}` | S | None | 200 progress counts and next status |
| DELETE `/invitations/{invitationId}` | S | If-Match | 204; withdraw, preserve history |
| POST `/invitations/{invitationId}/reinstate` | S | If-Match | 200 Invitation; preserves prior response/reminder |
| PATCH `/invitations/{invitationId}/rsvp` | S | expectedRevision, status: pending/attending/declined | 200 Invitation |

Duplicate email detection returns `409 DUPLICATE_EMAIL_CONFIRMATION_REQUIRED` with staff-visible matching guest IDs/names, not an automatic merge. Acknowledgment allows separate people to share a mailbox. Saving/updating guests or assignments never sends email.

Bulk assignment is **add missing invitations only**. Existing invited pairs count as unchanged; withdrawn pairs count as skipped and require explicit reinstatement. Snapshot two sorted ID lists, not a million pair objects. Compute totalPairs, process proposed chunks of 100 pairs, and save cursor plus counts in the same short transaction as each chunk. Worker retry cannot double-count or reset an RSVP. Removed guests and cancelled events are skipped after rechecking. Concurrent withdrawal is not undone because existing pair records are never recreated; unique pair index resolves concurrent additions. All errors remain as bounded counts/code summaries, not a million-item error array. Staff inspect affected event lists for details.

Operations expose status queued/running/completed/partial_failure/failed, totalPairs, processedPairs, created, unchanged, skipped, and failed counts. The requester must retain active staff access before each new chunk; otherwise stop with a safe error. Completed chunks remain committed. Infrastructure retries resume the same operation. Bulk withdrawal, CSV import, and an undo-all workflow are not added.

## 7. Email preview, sending, and status

| Method and route | Access | Input | Success |
| --- | --- | --- | --- |
| POST `/email-previews` | S for invitation; A for manual_reminder | kind, guestIds[1..1000], eventIds?[1..1000] | 200 selectedCount, eligibleCount, skipped counts/reasons, escaped sample, signed previewToken, expiresAt |
| POST `/email-operations` | Same as preview | previewToken; Idempotency-Key | 202 Operation; no synchronous provider send |
| GET `/email-operations` | S invitation history; A all permitted kinds | kind, pagination | 200 Operation list |
| GET `/email-operations/{operationId}` | Same per-kind rule | None | 200 Operation and per-state counts |
| GET `/email-operations/{operationId}/messages` | Same per-kind rule | status, pagination | 200 guest identity, recipient address, state/timestamps, safe failure code |
| POST `/email-operations/{operationId}/retry` | Same per-kind rule | messageIds[1..100], Idempotency-Key | 202 same operation reference; recover eligible failed messages only |

Preview tokens are signed, short-lived (proposed 10 minutes), actor-bound selection descriptors. They contain selected IDs, kind, template version, preview time, and a fingerprint of relevant contact/link/invitation revisions; no plaintext personal-link secrets. They are not authorization and do not send email. On submit, recheck role and fingerprint; changed selection facts return `409 PREVIEW_STALE`. A guest may still respond after submission; dispatch rechecks eligibility and may skip recipients. Preview count is an estimate at that time.

Invitation previews reference each guest's current assignments. `eventIds` narrows which events are described, never grants extra event access. For manual reminders, only pending active invitations are eligible. Proposed message summary cap: 10 event names and a link to the full paginated invitation. Gallery link and hosted QR are included in invitations. Sanitize preview HTML; return text plus a restricted HTML template rendered without executing scripts.

Operation persistence and outbox commit precede 202. Returning 202 does not promise that Resend accepted anything. Missing known sender configuration returns 503 `EMAIL_NOT_CONFIGURED` before creation; later outages become operation status. Freeze exact recipient/content/order when dispatch may begin, and reuse provider retry identities. Known pre-dispatch failures can retry; uncertain sends outside the safe provider window require review, not an automatic new identity. Accepted/delivered messages are excluded from retry. Corrected recipient/content requires resolving the previous outcome and a new explicit preview/send. A deliberate resend is a new operation, not a recovery retry. Account-email operations are not exposed in invitation history.

Daily scheduled reminders run internally under admin settings, never through an organizer-callable route. Follow the database's one seven-day reminder claim per guest-event invitation, grouped by guest when practical. Proposed 09:00 Asia/Kolkata remains pending approval. Deadline changes do not repeat accepted reminders; no automatic catch-up policy is silently selected here. Scheduled work and manual reminders retain separate histories.

## 8. Share links and guest-facing reads

| Method and route | Access | Input | Success |
| --- | --- | --- | --- |
| POST `/access/exchange` | Link token | kind: wedding/gallery/guest_invitation, token | 200 contextId, kind, expiresAt; scoped cookie |
| GET `/sharing` | A | pagination | 200 link metadata without secrets |
| POST `/sharing/links` | A | kind and guestId only for personal link | 201 link; one active per scope, existing active returns 409 |
| POST `/sharing/links/{linkId}/rotate` | A | If-Match | 200 replacement link; old generation revoked |
| DELETE `/sharing/links/{linkId}` | A | If-Match | 204; revoked |
| GET `/sharing/gallery` | S | eventId? | 200 current gallery URL and QR image URL; no link creation |
| GET `/sharing/wedding` | A | None | 200 current website URL |
| GET `/guests/{guestId}/invitation-link` | S | None | 200 current personal URL |
| GET `/sharing/qr` | Gallery bearer token | token, eventId? | 200 image/png; no envelope or redirect |
| GET `/guest/invitation` | Personal Link | X-Access-Context | 200 guest display name, wedding summary, gallery link, contextId |
| GET `/guest/invitation/events` | Personal Link | pagination | 200 EventGuest plus own Invitation/response per item |
| PATCH `/guest/invitations/{invitationId}/rsvp` | Personal Link | expectedRevision, status: attending/declined | 200 own RSVP; pending reset is staff-only |
| GET `/website` | Wedding Link or S | Context for link | 200 website content, image URLs, YouTube video ID, optional gallery link |
| GET `/website/events` | Wedding Link or S | pagination | 200 only wedding_link-visible active EventGuest records |

Provision wedding/gallery links during controlled setup and a personal link when a guest is created. Read/copy routes never create or reactivate missing/revoked links. Admin explicitly creates a replacement if a scope has none. GET `/sharing/qr` is a deliberate token-in-query exception for email image clients: accept **gallery** tokens only, redact the full query in every log, return no-store/no-referrer, verify current link before rendering, and generate PNG locally without sending token data to an external QR service. Event selection only identifies a folder. Its hosted URL is itself sensitive, as is the QR image. Revoke stops new rendering, but cannot retract saved screenshots. QR URLs never carry personal RSVP/reset tokens. Do not add external analytics to sharing pages.

Guest RSVP checks invitation owner from the verified link, not from client guestId. Active invitation/guest/event required; cancelled, archived, or withdrawn writes return conflict/unavailable. Responses remain editable after deadline under the documented proposal. Concurrent edits require refresh. No guest list, staff metadata, expense totals, or private event schedules are returned by gallery endpoints.

## 9. Gallery and website images

| Method and route | Access | Input | Success |
| --- | --- | --- | --- |
| GET `/gallery/albums` | Gallery Link or S | pagination | 200 event ID/name, acceptedPhotoCount, uploadsAllowed only |
| GET `/gallery/albums/{eventId}/photos` | Gallery Link or S | pagination | 200 accepted Photo list |
| GET `/gallery/photos/{photoId}` | Gallery Link or S | None | 200 Photo/status; pending visible only to initiating scope or admin |
| POST `/gallery/uploads` | Gallery Link or S | eventId, selectionId, files[1..20] | 201 selection result with photo IDs and R2 PUT instructions |
| POST `/gallery/uploads/{photoId}/renew` | Initiating scope or A | None | 200 fresh PUT URL if still pending; no overwrite of accepted asset |
| POST `/gallery/uploads/{photoId}/complete` | Initiating scope or A | None | 202 Photo/statusUrl; repeated completion returns existing state |
| POST `/gallery/photos/{photoId}/download` | Gallery Link or S | None | 200 url, expiresAt, safe filename; original bytes |
| DELETE `/gallery/photos/{photoId}` | A | If-Match | 202 deleting Photo/statusUrl; repeated deletion returns current state |
| POST `/website-images/uploads` | A | selectionId, files[1..20] | 201 upload instructions for website-purpose assets |
| GET `/website-images/{photoId}` | A | None | 200 processing status |
| POST `/website-images/{photoId}/renew` | A | None | 200 pending PUT URL |
| POST `/website-images/{photoId}/complete` | A | None | 202 statusUrl |
| DELETE `/website-images/{photoId}` | A | If-Match | 202; reject 409 if still referenced by website content |

Each file descriptor contains `clientFileId`, `name`, `sizeBytes`, `contentType`. Proposed 50 MB definition is 50,000,000 bytes; 1..20 files, three concurrent transfers, 15-minute PUT expiry, five-minute signed preview/download expiry. These are review defaults. The initiating scope is server-derived staff ID or gallery link ID, not a client-provided user ID. Gallery holders share the same bearer identity; this does not identify the actual photographer.

Example initiation:

```json
{
  "eventId": "660000000000000000000001",
  "selectionId": "a8f5518a-6436-4b0e-943e-8d82dc405093",
  "files": [
    { "clientFileId": "file-1", "name": "ceremony.jpg", "sizeBytes": 4200000, "contentType": "image/jpeg" }
  ]
}
```

Validate all metadata before creating upload records; invalid metadata returns indexed field errors. After acceptance, failures are per file. Return `files[{clientFileId,photoId,upload:{method:"PUT",url,headers,expiresAt}}]`. Browser PUTs bytes directly to R2 using the returned signed headers, then completes each uploaded file. Never accept arbitrary object keys/URLs in completion requests. A presigned URL is reusable until expiry; it is not a single-use upload receipt. [Cloudflare R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)

Validate actual size, file signature, supported JPEG/PNG/HEIC/HEIF decoding, and decoded dimensions/memory limits; client MIME and extension are hints only. Finalization promotes to an immutable destination and validates the exact promoted bytes before marking accepted. Cap pending storage and clean up expired/rejected staging objects. R2 CORS permits only configured site origins/methods/headers. Compression is applied only to separate variants. No whole image body passes through the JSON API.

Accepted photos become visible without moderation while previews may be processing. GET detail returns processing status; poll with bounded exponential backoff, honor Retry-After where supplied, and pause polling in hidden tabs. If preview generation fails, preserve the original and report processing failure. Deletion first hides the asset using `deleting`, then removes all known objects through retryable background work. Late workers cannot restore deleted photos. Previously issued URLs remain usable until expiry/object removal; revocation cannot undo a completed download. Automatic accepted-photo deletion and independent photo backup remain out of scope.

## 10. Expenses and sample planners

| Method and route | Access | Input | Success |
| --- | --- | --- | --- |
| GET `/expenses` | A | eventId?, category?, pagination | 200 Expense list |
| POST `/expenses` | A | clientRequestId, description, category, costMinor, paidMinor, eventId?, notes? | 201 Expense |
| GET `/expenses/{expenseId}` | A | None | 200 Expense |
| PATCH `/expenses/{expenseId}` | A | expectedRevision, writable expense fields | 200 Expense |
| DELETE `/expenses/{expenseId}` | A | If-Match | 204 soft deletion |
| GET `/expenses/summary` | A | eventId? | 200 currency, totalCostMinor, paidMinor, outstandingMinor |
| GET `/planners` | S | q?, area?, pagination | 200 sample listing list plus `isSample:true` |

Expense amounts are nonnegative integer strings within signed BSON 64-bit range; paid cannot exceed cost. Wedding currency is server-derived. Summary arithmetic also uses exact integers with explicit overflow handling. Planner records contain fixture ID, name, area, services, description, and only verified usable contacts/URLs. No live distance, bookings, or planner account API. Static `/expenses/summary` must not be treated as an expense ID.

## 11. Internal service boundaries

| Entry point | Caller and verification | Behavior |
| --- | --- | --- |
| `/api/inngest` | Inngest SDK signing verification for executions; production key configured | Durable assignment, email, photo, and reconciliation handlers; framework-specific SDK GET/POST/PUT behavior, not a public job trigger |
| `/api/webhooks/resend` POST | Verify provider signature/timestamp using exact raw body and official verification helper | Deduplicate provider event, persist before 2xx, correlate message and update delivery facts |
| Scheduled reminder handler | Inngest scheduled function configured daily | Evaluate eligible events and claim pending reminders; no browser-accessible cron URL |
| Reconciliation handler | Authenticated scheduled job | Recover unpublished outbox entries and stalled work in bounded pages |
| Database backup runner | Separate protected operational process | Weekly development/daily live exports; no public download/trigger endpoint |

No client may specify a background actor, arbitrary job name, recipient list, or trusted event payload directly to an internal execution route. Handlers resolve records and permissions again. Authentication-email handlers use challenge/user state rather than invitation-mail permissions. Verify raw webhook content before JSON parsing changes it; repeated valid callbacks return 2xx, storage failure returns retryable 5xx. Unknown provider message IDs are retained for later correlation. Earlier acceptance facts cannot overwrite a later delivery/bounce outcome. [Resend webhook verification](https://resend.com/docs/webhooks/verify-webhooks-requests)

Use the official framework handler and production signing configuration for Inngest. HTTP status does not bypass job-level authorization/idempotency checks. [Inngest HTTP serving](https://www.inngest.com/docs/learn/serving-inngest-functions)

No direct public MongoDB endpoints, generic collection CRUD, public email-send proxy, arbitrary URL-fetch endpoint, or guest-accessible job console is introduced.

## 12. Database additions and validation handoff

The API exposes an existing gap in durable bulk assignment. Proposed `assignmentOperations` stores wedding/actor IDs, unique requestKey, requestPayloadHash, bounded guestIds/eventIds, state, pair cursor, counters, lease generation, timestamps, and safe errors. Initial operation plus outbox commit atomically. Pair results plus progress commit in the same bounded transaction. Detailed addendum is in the [database technical reference](Make-My-Marriage-Database-Technical-Reference.md#16-api-design-addendum-24-september-2026).

Also propose internal clientRequestId/request hash fields for safe event/guest/expense creates. Staff invitation retries reuse the existing emailOperations request identity, with the user/challenge/outbox writes in the same transaction. These additions do not change the product scope. Exact validators/index migrations and shared rate-limiter storage are implementation tasks, not completed work.

Required contract validation before release:

- Every route tested against admin, organizer, missing credentials, and each wrong capability; especially manual reminders, expenses, photo deletion, and raw ID tampering.
- Account invite/verify/reset single-use behavior, neutral responses, revoked membership, CSRF failures, and session invalidation.
- Multiple personal links in separate tabs, revoked gallery cookies, and no token leakage through logs, referrers, cached responses, or QR services.
- One-million-pair assignment simulation with interrupted chunks, duplicate submissions, concurrent add/withdraw, and requester revocation; consistent counters and preserved RSVPs.
- 1,000-recipient test delivery: previews becoming stale, pending responses changing, provider quota failures, duplicate callbacks, partial failures, and uncertain retries.
- Pagination/filter validation and dashboard query/storage performance at the agreed scale; no million-record response or unbounded lookup arrays.
- Original byte preservation, expired/reused PUT URLs, spoofed MIME/size, HEIC decoding, per-file retries, and deletion racing preview generation.
- Exact currency serialization, paid<=cost, optimistic conflict behavior, and no unauthorized expense projection.

These are planned checks; no API server or load tests have been run. Open review items are reminder run time/catch-up policy, final cancellation behavior, token and upload timing defaults, password policy, live capacity tier, and the Auth.js/HEIC/runtime compatibility checks. Next, UI/UX should map screens to these operations and explicitly design pending, empty, conflict, failure, and retry states. A machine-readable OpenAPI specification can be generated during implementation after this contract is reviewed; this Markdown reference is the current proposed contract.

## 13. Complete endpoint examples

All 76 application endpoints below include a full method/path, access rule, request headers, input rules, JSON payload or explicit no-body instruction, success status/body, and a concrete error example. The earlier tables are a quick index; this section defines the proposed wire field names. Examples are synthetic, not live requests or executed API tests.

**Reading the examples:**

- Replace example IDs with IDs returned by your own instance. All hosts ending in `example.invalid` and all tokens/passwords/signatures here are nonfunctional placeholders. Never copy the example password into a real account.
- `AUTHJS_SESSION_COOKIE` is a label for the cookie name chosen by the pinned Auth.js setup, not a hard-coded production name. Cookies are sent automatically by the browser; frontend JavaScript cannot read HttpOnly cookie values.
- Browser mutations obtain CSRF protection first. Cookies/Origin headers shown here explain the HTTP exchange; JavaScript must not try to manually set protected browser headers.
- Gallery/website examples use their link cookies and context header. Staff can use the staff cookie on those same routes. Personal guest routes never accept staff fallback.
- Required headers are shown per endpoint. Request examples select one valid case; the input rules identify other allowed fields, nulls, enums, and limits. Unknown fields are rejected.
- Empty action POST bodies use `{}`; DELETE routes have no body. Do not call JSON parsing on an empty DELETE body.
- New creates return 201; identical acknowledged create replays return 200. Durable jobs return 202 with Location when a caller-visible status resource exists. Neutral recovery and private staff-invite responses deliberately have no operation polling Location.
- Only the stated nullable response fields use null; pending image responses omit sizes/URLs until known. A Photo does not expose storage object keys. Dates in examples are fixed illustrations, not the current clock.
- `If-Match` is required only on the lifecycle routes where explicitly shown below. Other POST actions use their own token/idempotency/state rules. PATCH uses expectedRevision.
- Returned error.details is optional safe structured context, such as currentRevision or staff-visible duplicate matches. Authorization checks precede record-specific error details.

### Endpoint index

| No. | Method and full endpoint | Details |
| --- | --- | --- |
| 01 | `GET /api/v1/security/csrf` | [Request / response](#endpoint-01) |
| 02 | `POST /api/v1/account/signup` | [Request / response](#endpoint-02) |
| 03 | `POST /api/v1/account/verify-email` | [Request / response](#endpoint-03) |
| 04 | `POST /api/v1/account/resend-verification` | [Request / response](#endpoint-04) |
| 05 | `POST /api/v1/account/forgot-password` | [Request / response](#endpoint-05) |
| 06 | `POST /api/v1/account/reset-password` | [Request / response](#endpoint-06) |
| 07 | `GET /api/v1/me` | [Request / response](#endpoint-07) |
| 08 | `GET /api/v1/staff` | [Request / response](#endpoint-08) |
| 09 | `POST /api/v1/staff/invitations` | [Request / response](#endpoint-09) |
| 10 | `POST /api/v1/staff/{userId}/invitation-resends` | [Request / response](#endpoint-10) |
| 11 | `DELETE /api/v1/staff/{userId}/access` | [Request / response](#endpoint-11) |
| 12 | `GET /api/v1/wedding` | [Request / response](#endpoint-12) |
| 13 | `PATCH /api/v1/wedding` | [Request / response](#endpoint-13) |
| 14 | `GET /api/v1/reminder-settings` | [Request / response](#endpoint-14) |
| 15 | `PATCH /api/v1/reminder-settings` | [Request / response](#endpoint-15) |
| 16 | `GET /api/v1/dashboard` | [Request / response](#endpoint-16) |
| 17 | `GET /api/v1/dashboard/events` | [Request / response](#endpoint-17) |
| 18 | `GET /api/v1/events` | [Request / response](#endpoint-18) |
| 19 | `POST /api/v1/events` | [Request / response](#endpoint-19) |
| 20 | `GET /api/v1/events/{eventId}` | [Request / response](#endpoint-20) |
| 21 | `PATCH /api/v1/events/{eventId}` | [Request / response](#endpoint-21) |
| 22 | `POST /api/v1/events/{eventId}/cancel` | [Request / response](#endpoint-22) |
| 23 | `POST /api/v1/events/{eventId}/archive` | [Request / response](#endpoint-23) |
| 24 | `PATCH /api/v1/events/{eventId}/reminder-settings` | [Request / response](#endpoint-24) |
| 25 | `GET /api/v1/guests` | [Request / response](#endpoint-25) |
| 26 | `POST /api/v1/guests` | [Request / response](#endpoint-26) |
| 27 | `GET /api/v1/guests/{guestId}` | [Request / response](#endpoint-27) |
| 28 | `PATCH /api/v1/guests/{guestId}` | [Request / response](#endpoint-28) |
| 29 | `DELETE /api/v1/guests/{guestId}` | [Request / response](#endpoint-29) |
| 30 | `GET /api/v1/guests/{guestId}/invitations` | [Request / response](#endpoint-30) |
| 31 | `GET /api/v1/events/{eventId}/invitations` | [Request / response](#endpoint-31) |
| 32 | `POST /api/v1/assignment-operations` | [Request / response](#endpoint-32) |
| 33 | `GET /api/v1/assignment-operations/{operationId}` | [Request / response](#endpoint-33) |
| 34 | `DELETE /api/v1/invitations/{invitationId}` | [Request / response](#endpoint-34) |
| 35 | `POST /api/v1/invitations/{invitationId}/reinstate` | [Request / response](#endpoint-35) |
| 36 | `PATCH /api/v1/invitations/{invitationId}/rsvp` | [Request / response](#endpoint-36) |
| 37 | `POST /api/v1/email-previews` | [Request / response](#endpoint-37) |
| 38 | `POST /api/v1/email-operations` | [Request / response](#endpoint-38) |
| 39 | `GET /api/v1/email-operations` | [Request / response](#endpoint-39) |
| 40 | `GET /api/v1/email-operations/{operationId}` | [Request / response](#endpoint-40) |
| 41 | `GET /api/v1/email-operations/{operationId}/messages` | [Request / response](#endpoint-41) |
| 42 | `POST /api/v1/email-operations/{operationId}/retry` | [Request / response](#endpoint-42) |
| 43 | `POST /api/v1/access/exchange` | [Request / response](#endpoint-43) |
| 44 | `GET /api/v1/sharing` | [Request / response](#endpoint-44) |
| 45 | `POST /api/v1/sharing/links` | [Request / response](#endpoint-45) |
| 46 | `POST /api/v1/sharing/links/{linkId}/rotate` | [Request / response](#endpoint-46) |
| 47 | `DELETE /api/v1/sharing/links/{linkId}` | [Request / response](#endpoint-47) |
| 48 | `GET /api/v1/sharing/gallery` | [Request / response](#endpoint-48) |
| 49 | `GET /api/v1/sharing/wedding` | [Request / response](#endpoint-49) |
| 50 | `GET /api/v1/guests/{guestId}/invitation-link` | [Request / response](#endpoint-50) |
| 51 | `GET /api/v1/sharing/qr` | [Request / response](#endpoint-51) |
| 52 | `GET /api/v1/guest/invitation` | [Request / response](#endpoint-52) |
| 53 | `GET /api/v1/guest/invitation/events` | [Request / response](#endpoint-53) |
| 54 | `PATCH /api/v1/guest/invitations/{invitationId}/rsvp` | [Request / response](#endpoint-54) |
| 55 | `GET /api/v1/website` | [Request / response](#endpoint-55) |
| 56 | `GET /api/v1/website/events` | [Request / response](#endpoint-56) |
| 57 | `GET /api/v1/gallery/albums` | [Request / response](#endpoint-57) |
| 58 | `GET /api/v1/gallery/albums/{eventId}/photos` | [Request / response](#endpoint-58) |
| 59 | `GET /api/v1/gallery/photos/{photoId}` | [Request / response](#endpoint-59) |
| 60 | `POST /api/v1/gallery/uploads` | [Request / response](#endpoint-60) |
| 61 | `POST /api/v1/gallery/uploads/{photoId}/renew` | [Request / response](#endpoint-61) |
| 62 | `POST /api/v1/gallery/uploads/{photoId}/complete` | [Request / response](#endpoint-62) |
| 63 | `POST /api/v1/gallery/photos/{photoId}/download` | [Request / response](#endpoint-63) |
| 64 | `DELETE /api/v1/gallery/photos/{photoId}` | [Request / response](#endpoint-64) |
| 65 | `POST /api/v1/website-images/uploads` | [Request / response](#endpoint-65) |
| 66 | `GET /api/v1/website-images/{photoId}` | [Request / response](#endpoint-66) |
| 67 | `POST /api/v1/website-images/{photoId}/renew` | [Request / response](#endpoint-67) |
| 68 | `POST /api/v1/website-images/{photoId}/complete` | [Request / response](#endpoint-68) |
| 69 | `DELETE /api/v1/website-images/{photoId}` | [Request / response](#endpoint-69) |
| 70 | `GET /api/v1/expenses` | [Request / response](#endpoint-70) |
| 71 | `POST /api/v1/expenses` | [Request / response](#endpoint-71) |
| 72 | `GET /api/v1/expenses/{expenseId}` | [Request / response](#endpoint-72) |
| 73 | `PATCH /api/v1/expenses/{expenseId}` | [Request / response](#endpoint-73) |
| 74 | `DELETE /api/v1/expenses/{expenseId}` | [Request / response](#endpoint-74) |
| 75 | `GET /api/v1/expenses/summary` | [Request / response](#endpoint-75) |
| 76 | `GET /api/v1/planners` | [Request / response](#endpoint-76) |


### endpoint-01

**GET /api/v1/security/csrf**

**Access:** Anonymous.

**Input rules:** Creates only CSRF request protection, not wedding access. The token returned in JSON is sent as X-CSRF-Token on application mutations.

**Request and headers**

```http
GET /api/v1/security/csrf HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
```

**Request payload:** None. Use the query string shown above where applicable.

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
Set-Cookie: mmm_csrf=signed-placeholder; Path=/; Secure; HttpOnly; SameSite=Lax
```

```json
{
  "data": {
    "csrfToken": "csrf-placeholder"
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 503**

```json
{
  "error": {
    "code": "TEMPORARILY_UNAVAILABLE",
    "message": "Please try again shortly."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-02

**POST /api/v1/account/signup**

**Access:** Staff invite token.

**Input rules:** All five fields required. Name 1..200 characters; email must match invitation. Password and confirmation 12..128 characters and identical. No role field. Success does not grant a session.

**Request and headers**

```http
POST /api/v1/account/signup HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Content-Type: application/json
Origin: https://wedding.example.invalid
Cookie: mmm_csrf=signed-placeholder
X-CSRF-Token: csrf-placeholder
```

**JSON request payload**

```json
{
  "inviteToken": "staff-invite-placeholder",
  "name": "Wedding Organizer",
  "email": "organizer@example.com",
  "password": "Example-only-passphrase-2026!",
  "passwordConfirmation": "Example-only-passphrase-2026!"
}
```

**Success response**

```http
HTTP/1.1 201 Created
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "state": "verification_required"
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 422**

```json
{
  "error": {
    "code": "TOKEN_UNAVAILABLE",
    "message": "This account link is invalid, expired, or already used."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-03

**POST /api/v1/account/verify-email**

**Access:** Verification token.

**Input rules:** Required opaque single-use token. Opening an email page must not consume the token; only this POST does.

**Request and headers**

```http
POST /api/v1/account/verify-email HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Content-Type: application/json
Origin: https://wedding.example.invalid
Cookie: mmm_csrf=signed-placeholder
X-CSRF-Token: csrf-placeholder
```

**JSON request payload**

```json
{
  "token": "verification-placeholder"
}
```

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "state": "verified"
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 422**

```json
{
  "error": {
    "code": "TOKEN_UNAVAILABLE",
    "message": "This account link is invalid, expired, or already used."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-04

**POST /api/v1/account/resend-verification**

**Access:** Anonymous.

**Input rules:** Required valid email. Always the same 202 body for eligible and ineligible addresses. No operation or user ID is exposed. Anonymous 202 responses intentionally have no status Location to avoid account disclosure.

**Request and headers**

```http
POST /api/v1/account/resend-verification HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Content-Type: application/json
Origin: https://wedding.example.invalid
Cookie: mmm_csrf=signed-placeholder
X-CSRF-Token: csrf-placeholder
```

**JSON request payload**

```json
{
  "email": "organizer@example.com"
}
```

**Success response**

```http
HTTP/1.1 202 Accepted
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "message": "If this address is eligible, an email will be sent."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 429**

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 3600
Content-Type: application/json
```

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Please wait before requesting another email."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-05

**POST /api/v1/account/forgot-password**

**Access:** Anonymous.

**Input rules:** Required valid email. Always the same 202 body for eligible and ineligible addresses. No operation or user ID is exposed. Anonymous 202 responses intentionally have no status Location to avoid account disclosure.

**Request and headers**

```http
POST /api/v1/account/forgot-password HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Content-Type: application/json
Origin: https://wedding.example.invalid
Cookie: mmm_csrf=signed-placeholder
X-CSRF-Token: csrf-placeholder
```

**JSON request payload**

```json
{
  "email": "organizer@example.com"
}
```

**Success response**

```http
HTTP/1.1 202 Accepted
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "message": "If this address is eligible, an email will be sent."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 429**

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 3600
Content-Type: application/json
```

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Please wait before requesting another email."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-06

**POST /api/v1/account/reset-password**

**Access:** Reset token.

**Input rules:** All fields required. Proposed password length 12..128; confirmation must match. Consumes reset token and invalidates old sessions. Does not restore revoked membership.

**Request and headers**

```http
POST /api/v1/account/reset-password HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Content-Type: application/json
Origin: https://wedding.example.invalid
Cookie: mmm_csrf=signed-placeholder
X-CSRF-Token: csrf-placeholder
```

**JSON request payload**

```json
{
  "token": "reset-placeholder",
  "password": "Example-only-passphrase-2026!",
  "passwordConfirmation": "Example-only-passphrase-2026!"
}
```

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "state": "password_reset",
    "requiresLogin": true
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 422**

```json
{
  "error": {
    "code": "TOKEN_UNAVAILABLE",
    "message": "This account link is invalid, expired, or already used."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-07

**GET /api/v1/me**

**Access:** S.

**Input rules:** Example is an organizer. Permissions are UI hints computed by the server; every action still checks current membership and role. Admin responses contain the additional admin capabilities.

**Request and headers**

```http
GET /api/v1/me HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder
```

**Request payload:** None. Use the query string shown above where applicable.

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "id": "660000000000000000000004",
    "revision": 1,
    "createdAt": "2026-09-24T08:30:00.000Z",
    "updatedAt": "2026-09-24T08:30:00.000Z",
    "name": "Wedding Organizer",
    "email": "organizer@example.com",
    "role": "organizer",
    "status": "active",
    "emailVerifiedAt": "2026-09-24T08:30:00.000Z",
    "permissions": [
      "events.manage",
      "guests.manage",
      "invitations.manage",
      "invitations.send",
      "rsvps.manage",
      "gallery.read",
      "gallery.upload",
      "gallery.download",
      "planners.read"
    ],
    "wedding": {
      "timeZone": "Asia/Kolkata",
      "currency": "INR",
      "currencyMinorUnit": 2
    }
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 401**

```json
{
  "error": {
    "code": "SESSION_REQUIRED",
    "message": "Please sign in again."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-08

**GET /api/v1/staff**

**Access:** A.

**Input rules:** Optional status: invited, pending_verification, active, revoked. Optional `limit` integer 1..100 (default 50) and opaque `cursor` string. Omit cursor for the first page; pass the returned nextCursor unchanged for the next page. No total count is implied.

**Request and headers**

```http
GET /api/v1/staff?status=active&limit=50 HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder
```

**Request payload:** None. Use the query string shown above where applicable.

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "items": [
      {
        "id": "660000000000000000000004",
        "revision": 1,
        "createdAt": "2026-09-24T08:30:00.000Z",
        "updatedAt": "2026-09-24T08:30:00.000Z",
        "name": "Wedding Organizer",
        "email": "organizer@example.com",
        "role": "organizer",
        "status": "active",
        "emailVerifiedAt": "2026-09-24T08:30:00.000Z"
      }
    ],
    "nextCursor": null
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 403**

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "This account cannot perform this action."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-09

**POST /api/v1/staff/invitations**

**Access:** A.

**Input rules:** Email is required for a new invitation; resending takes only the path user ID. Admin role cannot be supplied. Background acceptance is not email delivery. Account-email operations are private: use GET /staff for membership status; there is deliberately no public polling URL for this operation ID.

**Request and headers**

```http
POST /api/v1/staff/invitations HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Content-Type: application/json
Origin: https://wedding.example.invalid
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder; mmm_csrf=signed-placeholder
X-CSRF-Token: csrf-placeholder
Idempotency-Key: b75eb112-b544-43ae-a9a2-daf738540a92
```

**JSON request payload**

```json
{
  "email": "organizer@example.com"
}
```

**Success response**

```http
HTTP/1.1 202 Accepted
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "userId": "660000000000000000000004",
    "operationId": "660000000000000000000005",
    "status": "queued"
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 409**

```json
{
  "error": {
    "code": "STAFF_ALREADY_ACTIVE",
    "message": "This organizer already has active access."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-10

**POST /api/v1/staff/{userId}/invitation-resends**

**Access:** A.

**Input rules:** Email is required for a new invitation; resending takes only the path user ID. Admin role cannot be supplied. Background acceptance is not email delivery. Account-email operations are private: use GET /staff for membership status; there is deliberately no public polling URL for this operation ID.

**Path parameters:** `userId`: required 24-character hexadecimal ID.

**Request and headers**

```http
POST /api/v1/staff/660000000000000000000004/invitation-resends HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Content-Type: application/json
Origin: https://wedding.example.invalid
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder; mmm_csrf=signed-placeholder
X-CSRF-Token: csrf-placeholder
Idempotency-Key: b75eb112-b544-43ae-a9a2-daf738540a92
If-Match: "1"
```

**JSON request payload**

```json
{}
```

**Success response**

```http
HTTP/1.1 202 Accepted
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "userId": "660000000000000000000004",
    "operationId": "660000000000000000000005",
    "status": "queued"
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 409**

```json
{
  "error": {
    "code": "REVISION_CONFLICT",
    "message": "This record changed. Reload it before trying again.",
    "details": {
      "currentRevision": 2
    }
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-11

**DELETE /api/v1/staff/{userId}/access**

**Access:** A.

**Input rules:** Path userId must identify an organizer. Revocation invalidates sessions immediately on the next authorization check.

**Path parameters:** `userId`: required 24-character hexadecimal ID.

**Request and headers**

```http
DELETE /api/v1/staff/660000000000000000000004/access HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Content-Type: application/json
Origin: https://wedding.example.invalid
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder; mmm_csrf=signed-placeholder
X-CSRF-Token: csrf-placeholder
If-Match: "1"
```

**Request payload:** None. Send an empty HTTP body; this route does not parse a JSON document.

**Success response**

```http
HTTP/1.1 204 No Content
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
```

No response body.

**Error example — HTTP 409**

```json
{
  "error": {
    "code": "ADMIN_ACCESS_PROTECTED",
    "message": "Admin access cannot be removed through organizer management."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-12

**GET /api/v1/wedding**

**Access:** A.

**Input rules:** No request body or query parameters. Standard authorization and ownership checks apply.

**Request and headers**

```http
GET /api/v1/wedding HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder
```

**Request payload:** None. Use the query string shown above where applicable.

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "id": "660000000000000000000009",
    "revision": 1,
    "createdAt": "2026-09-24T08:30:00.000Z",
    "updatedAt": "2026-09-24T08:30:00.000Z",
    "couple": {
      "partnerOneName": "Anaya",
      "partnerTwoName": "Rohan"
    },
    "weddingDate": "2027-02-08",
    "timeZone": "Asia/Kolkata",
    "currency": "INR",
    "currencyMinorUnit": 2,
    "website": {
      "story": "We look forward to celebrating with you.",
      "venue": {
        "name": "Rose Garden",
        "address": "Example Road, Jaipur",
        "instructions": "Use the main entrance."
      },
      "imageAssetIds": [],
      "template": "elegant_floral"
    },
    "youtubeVideoId": null
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 403**

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "This account cannot perform this action."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-13

**PATCH /api/v1/wedding**

**Access:** A.

**Input rules:** Required expectedRevision and at least one change. Allowed: couple.partnerOneName/partnerTwoName (1..200), weddingDate (date or null during setup), timeZone (IANA), currency (ISO code), website.story (<=10,000), website.venue (name/address/instructions), website.imageAssetIds (0..20 ready website asset IDs), youtubeVideoId (validated ID or null). Nested objects merge only allowlisted fields. Template, currencyMinorUnit, roles, reminder switches, and status are not writable here. Optional story/instructions may be cleared with null; required venue fields cannot. The example changes only the story.

**Request and headers**

```http
PATCH /api/v1/wedding HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Content-Type: application/json
Origin: https://wedding.example.invalid
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder; mmm_csrf=signed-placeholder
X-CSRF-Token: csrf-placeholder
```

**JSON request payload**

```json
{
  "expectedRevision": 1,
  "website": {
    "story": "We cannot wait to celebrate with you."
  }
}
```

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "id": "660000000000000000000009",
    "revision": 2,
    "createdAt": "2026-09-24T08:30:00.000Z",
    "updatedAt": "2026-09-24T08:30:00.000Z",
    "couple": {
      "partnerOneName": "Anaya",
      "partnerTwoName": "Rohan"
    },
    "weddingDate": "2027-02-08",
    "timeZone": "Asia/Kolkata",
    "currency": "INR",
    "currencyMinorUnit": 2,
    "website": {
      "story": "We cannot wait to celebrate with you.",
      "venue": {
        "name": "Rose Garden",
        "address": "Example Road, Jaipur",
        "instructions": "Use the main entrance."
      },
      "imageAssetIds": [],
      "template": "elegant_floral"
    },
    "youtubeVideoId": null
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 409**

```json
{
  "error": {
    "code": "CURRENCY_LOCKED",
    "message": "The currency cannot change after expenses have been recorded."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-14

**GET /api/v1/reminder-settings**

**Access:** A.

**Input rules:** No request body or query parameters. Standard authorization and ownership checks apply.

**Request and headers**

```http
GET /api/v1/reminder-settings HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder
```

**Request payload:** None. Use the query string shown above where applicable.

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "enabled": false,
    "leadDays": 7,
    "localRunTime": "09:00",
    "revision": 1
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 403**

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "This account cannot perform this action."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-15

**PATCH /api/v1/reminder-settings**

**Access:** A.

**Input rules:** Required expectedRevision; supply enabled (boolean) and/or localRunTime (HH:mm, 24-hour wedding-local time). leadDays is fixed at 7 and cannot be changed. Proposed run-time configuration remains for review.

**Request and headers**

```http
PATCH /api/v1/reminder-settings HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Content-Type: application/json
Origin: https://wedding.example.invalid
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder; mmm_csrf=signed-placeholder
X-CSRF-Token: csrf-placeholder
```

**JSON request payload**

```json
{
  "expectedRevision": 1,
  "enabled": true,
  "localRunTime": "09:00"
}
```

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "enabled": true,
    "leadDays": 7,
    "localRunTime": "09:00",
    "revision": 2
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 422**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please check the highlighted fields.",
    "fields": [
      {
        "path": "localRunTime",
        "message": "Enter a valid value."
      }
    ]
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-16

**GET /api/v1/dashboard**

**Access:** S.

**Input rules:** Example is the admin projection. Organizer response omits the expenses key entirely, not null/zero. Counts cover active records and actual assignments; no guest arrays are returned.

**Request and headers**

```http
GET /api/v1/dashboard HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder
```

**Request payload:** None. Use the query string shown above where applicable.

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "uniqueGuests": 1000,
    "activeEvents": 1000,
    "invitations": {
      "total": 5000,
      "pending": 2000,
      "attending": 2800,
      "declined": 200
    },
    "expenses": {
      "currency": "INR",
      "currencyMinorUnit": 2,
      "totalCostMinor": "125050",
      "paidMinor": "50000",
      "outstandingMinor": "75050"
    }
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 401**

```json
{
  "error": {
    "code": "SESSION_REQUIRED",
    "message": "Please sign in again."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-17

**GET /api/v1/dashboard/events**

**Access:** S.

**Input rules:** Optional status: active, cancelled, archived. Optional `limit` integer 1..100 (default 50) and opaque `cursor` string. Omit cursor for the first page; pass the returned nextCursor unchanged for the next page. No total count is implied.

**Request and headers**

```http
GET /api/v1/dashboard/events?status=active&limit=50 HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder
```

**Request payload:** None. Use the query string shown above where applicable.

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "items": [
      {
        "eventId": "660000000000000000000001",
        "name": "Ceremony",
        "status": "active",
        "startsAt": "2027-02-08T04:30:00.000Z",
        "invited": 1000,
        "pending": 400,
        "attending": 550,
        "declined": 50
      }
    ],
    "nextCursor": null
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 422**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please check the highlighted fields.",
    "fields": [
      {
        "path": "limit",
        "message": "Enter a valid value."
      }
    ]
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-18

**GET /api/v1/events**

**Access:** S.

**Input rules:** Optional q <=100 characters, status active/cancelled/archived, and offset timestamps from/to filtering startsAt (from inclusive, to exclusive). Require from < to when both present. Optional `limit` integer 1..100 (default 50) and opaque `cursor` string. Omit cursor for the first page; pass the returned nextCursor unchanged for the next page. No total count is implied.

**Request and headers**

```http
GET /api/v1/events?q=Ceremony&status=active&from=2027-02-01T00%3A00%3A00Z&to=2027-03-01T00%3A00%3A00Z&limit=50 HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder
```

**Request payload:** None. Use the query string shown above where applicable.

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "items": [
      {
        "id": "660000000000000000000001",
        "revision": 1,
        "createdAt": "2026-09-24T08:30:00.000Z",
        "updatedAt": "2026-09-24T08:30:00.000Z",
        "name": "Ceremony",
        "startsAt": "2027-02-08T04:30:00.000Z",
        "endsAt": "2027-02-08T07:30:00.000Z",
        "venue": {
          "name": "Rose Garden",
          "address": "Example Road, Jaipur",
          "instructions": "Use the main entrance."
        },
        "description": "Join us for the ceremony.",
        "visibility": "invited_only",
        "status": "active",
        "rsvp": {
          "deadlineLocalDate": "2027-02-01",
          "deadlineAt": "2027-02-01T18:29:59.999Z",
          "reminderEnabled": false
        },
        "gallery": {
          "acceptUploads": true
        }
      }
    ],
    "nextCursor": null
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 422**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please check the highlighted fields.",
    "fields": [
      {
        "path": "from",
        "message": "Enter a valid value."
      }
    ]
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-19

**POST /api/v1/events**

**Access:** S.

**Input rules:** Required clientRequestId (UUID), name, startsAt with UTC offset, venue.name and venue.address. Optional endsAt, venue.instructions, description, visibility (invited_only default or wedding_link), deadlineLocalDate. End cannot precede start; deadline must not be after start. Reminders start disabled. Replayed matching clientRequestId returns 200 existing record, not a second 201.

**Request and headers**

```http
POST /api/v1/events HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Content-Type: application/json
Origin: https://wedding.example.invalid
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder; mmm_csrf=signed-placeholder
X-CSRF-Token: csrf-placeholder
```

**JSON request payload**

```json
{
  "clientRequestId": "b75eb112-b544-43ae-a9a2-daf738540a92",
  "name": "Ceremony",
  "startsAt": "2027-02-08T10:00:00+05:30",
  "endsAt": "2027-02-08T13:00:00+05:30",
  "venue": {
    "name": "Rose Garden",
    "address": "Example Road, Jaipur",
    "instructions": "Use the main entrance."
  },
  "description": "Join us for the ceremony.",
  "visibility": "invited_only",
  "deadlineLocalDate": "2027-02-01"
}
```

**Success response**

```http
HTTP/1.1 201 Created
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
Location: /api/v1/events/660000000000000000000001
```

```json
{
  "data": {
    "id": "660000000000000000000001",
    "revision": 1,
    "createdAt": "2026-09-24T08:30:00.000Z",
    "updatedAt": "2026-09-24T08:30:00.000Z",
    "name": "Ceremony",
    "startsAt": "2027-02-08T04:30:00.000Z",
    "endsAt": "2027-02-08T07:30:00.000Z",
    "venue": {
      "name": "Rose Garden",
      "address": "Example Road, Jaipur",
      "instructions": "Use the main entrance."
    },
    "description": "Join us for the ceremony.",
    "visibility": "invited_only",
    "status": "active",
    "rsvp": {
      "deadlineLocalDate": "2027-02-01",
      "deadlineAt": "2027-02-01T18:29:59.999Z",
      "reminderEnabled": false
    },
    "gallery": {
      "acceptUploads": true
    }
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 422**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please check the highlighted fields.",
    "fields": [
      {
        "path": "startsAt",
        "message": "Enter a valid value."
      }
    ]
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-20

**GET /api/v1/events/{eventId}**

**Access:** S.

**Input rules:** No request body or query parameters. Standard authorization and ownership checks apply.

**Path parameters:** `eventId`: required 24-character hexadecimal ID.

**Request and headers**

```http
GET /api/v1/events/660000000000000000000001 HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder
```

**Request payload:** None. Use the query string shown above where applicable.

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "id": "660000000000000000000001",
    "revision": 1,
    "createdAt": "2026-09-24T08:30:00.000Z",
    "updatedAt": "2026-09-24T08:30:00.000Z",
    "name": "Ceremony",
    "startsAt": "2027-02-08T04:30:00.000Z",
    "endsAt": "2027-02-08T07:30:00.000Z",
    "venue": {
      "name": "Rose Garden",
      "address": "Example Road, Jaipur",
      "instructions": "Use the main entrance."
    },
    "description": "Join us for the ceremony.",
    "visibility": "invited_only",
    "status": "active",
    "rsvp": {
      "deadlineLocalDate": "2027-02-01",
      "deadlineAt": "2027-02-01T18:29:59.999Z",
      "reminderEnabled": false
    },
    "gallery": {
      "acceptUploads": true
    }
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 404**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "This record is unavailable."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-21

**PATCH /api/v1/events/{eventId}**

**Access:** S.

**Input rules:** Required expectedRevision and at least one change. Allowed name, startsAt, endsAt, venue, description, visibility, deadlineLocalDate; only admins may also supply gallery.acceptUploads. Same validation as create. Null can clear endsAt, description, venue.instructions, and deadlineLocalDate (only with reminders disabled). Do not pass status, reminderEnabled, or weddingId.

**Path parameters:** `eventId`: required 24-character hexadecimal ID.

**Request and headers**

```http
PATCH /api/v1/events/660000000000000000000001 HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Content-Type: application/json
Origin: https://wedding.example.invalid
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder; mmm_csrf=signed-placeholder
X-CSRF-Token: csrf-placeholder
```

**JSON request payload**

```json
{
  "expectedRevision": 1,
  "name": "Wedding Ceremony"
}
```

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "id": "660000000000000000000001",
    "revision": 2,
    "createdAt": "2026-09-24T08:30:00.000Z",
    "updatedAt": "2026-09-24T08:30:00.000Z",
    "name": "Wedding Ceremony",
    "startsAt": "2027-02-08T04:30:00.000Z",
    "endsAt": "2027-02-08T07:30:00.000Z",
    "venue": {
      "name": "Rose Garden",
      "address": "Example Road, Jaipur",
      "instructions": "Use the main entrance."
    },
    "description": "Join us for the ceremony.",
    "visibility": "invited_only",
    "status": "active",
    "rsvp": {
      "deadlineLocalDate": "2027-02-01",
      "deadlineAt": "2027-02-01T18:29:59.999Z",
      "reminderEnabled": false
    },
    "gallery": {
      "acceptUploads": true
    }
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 409**

```json
{
  "error": {
    "code": "REVISION_CONFLICT",
    "message": "This record changed. Reload it before trying again.",
    "details": {
      "currentRevision": 2
    }
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-22

**POST /api/v1/events/{eventId}/cancel**

**Access:** S.

**Input rules:** An empty JSON object is required; reason or arbitrary status fields are not accepted. Preserve records/photos, stop active invitations and RSVP writes. Gallery browsing stays available under the proposed lifecycle rule.

**Path parameters:** `eventId`: required 24-character hexadecimal ID.

**Request and headers**

```http
POST /api/v1/events/660000000000000000000001/cancel HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Content-Type: application/json
Origin: https://wedding.example.invalid
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder; mmm_csrf=signed-placeholder
X-CSRF-Token: csrf-placeholder
If-Match: "1"
```

**JSON request payload**

```json
{}
```

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "id": "660000000000000000000001",
    "revision": 2,
    "createdAt": "2026-09-24T08:30:00.000Z",
    "updatedAt": "2026-09-24T08:30:00.000Z",
    "name": "Ceremony",
    "startsAt": "2027-02-08T04:30:00.000Z",
    "endsAt": "2027-02-08T07:30:00.000Z",
    "venue": {
      "name": "Rose Garden",
      "address": "Example Road, Jaipur",
      "instructions": "Use the main entrance."
    },
    "description": "Join us for the ceremony.",
    "visibility": "invited_only",
    "status": "cancelled",
    "rsvp": {
      "deadlineLocalDate": "2027-02-01",
      "deadlineAt": "2027-02-01T18:29:59.999Z",
      "reminderEnabled": false
    },
    "gallery": {
      "acceptUploads": false
    }
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 409**

```json
{
  "error": {
    "code": "REVISION_CONFLICT",
    "message": "This record changed. Reload it before trying again.",
    "details": {
      "currentRevision": 2
    }
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-23

**POST /api/v1/events/{eventId}/archive**

**Access:** S.

**Input rules:** An empty JSON object is required; reason or arbitrary status fields are not accepted. Preserve records/photos, stop active invitations and RSVP writes. Gallery browsing stays available under the proposed lifecycle rule.

**Path parameters:** `eventId`: required 24-character hexadecimal ID.

**Request and headers**

```http
POST /api/v1/events/660000000000000000000001/archive HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Content-Type: application/json
Origin: https://wedding.example.invalid
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder; mmm_csrf=signed-placeholder
X-CSRF-Token: csrf-placeholder
If-Match: "1"
```

**JSON request payload**

```json
{}
```

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "id": "660000000000000000000001",
    "revision": 2,
    "createdAt": "2026-09-24T08:30:00.000Z",
    "updatedAt": "2026-09-24T08:30:00.000Z",
    "name": "Ceremony",
    "startsAt": "2027-02-08T04:30:00.000Z",
    "endsAt": "2027-02-08T07:30:00.000Z",
    "venue": {
      "name": "Rose Garden",
      "address": "Example Road, Jaipur",
      "instructions": "Use the main entrance."
    },
    "description": "Join us for the ceremony.",
    "visibility": "invited_only",
    "status": "archived",
    "rsvp": {
      "deadlineLocalDate": "2027-02-01",
      "deadlineAt": "2027-02-01T18:29:59.999Z",
      "reminderEnabled": false
    },
    "gallery": {
      "acceptUploads": false
    }
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 409**

```json
{
  "error": {
    "code": "REVISION_CONFLICT",
    "message": "This record changed. Reload it before trying again.",
    "details": {
      "currentRevision": 2
    }
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-24

**PATCH /api/v1/events/{eventId}/reminder-settings**

**Access:** A.

**Input rules:** Both fields required. Uses the event revision, not a separate counter. Global and event reminder switches must both be enabled for scheduled dispatch.

**Path parameters:** `eventId`: required 24-character hexadecimal ID.

**Request and headers**

```http
PATCH /api/v1/events/660000000000000000000001/reminder-settings HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Content-Type: application/json
Origin: https://wedding.example.invalid
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder; mmm_csrf=signed-placeholder
X-CSRF-Token: csrf-placeholder
```

**JSON request payload**

```json
{
  "expectedRevision": 1,
  "enabled": true
}
```

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "id": "660000000000000000000001",
    "revision": 2,
    "createdAt": "2026-09-24T08:30:00.000Z",
    "updatedAt": "2026-09-24T08:30:00.000Z",
    "name": "Ceremony",
    "startsAt": "2027-02-08T04:30:00.000Z",
    "endsAt": "2027-02-08T07:30:00.000Z",
    "venue": {
      "name": "Rose Garden",
      "address": "Example Road, Jaipur",
      "instructions": "Use the main entrance."
    },
    "description": "Join us for the ceremony.",
    "visibility": "invited_only",
    "status": "active",
    "rsvp": {
      "deadlineLocalDate": "2027-02-01",
      "deadlineAt": "2027-02-01T18:29:59.999Z",
      "reminderEnabled": true
    },
    "gallery": {
      "acceptUploads": true
    }
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 422**

```json
{
  "error": {
    "code": "RSVP_DEADLINE_REQUIRED",
    "message": "Set an RSVP deadline before enabling reminders."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-25

**GET /api/v1/guests**

**Access:** S.

**Input rules:** Optional q <=100 characters matching literal name/email, status active/removed. Optional `limit` integer 1..100 (default 50) and opaque `cursor` string. Omit cursor for the first page; pass the returned nextCursor unchanged for the next page. No total count is implied.

**Request and headers**

```http
GET /api/v1/guests?q=Aarav&status=active&limit=50 HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder
```

**Request payload:** None. Use the query string shown above where applicable.

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "items": [
      {
        "id": "660000000000000000000002",
        "revision": 1,
        "createdAt": "2026-09-24T08:30:00.000Z",
        "updatedAt": "2026-09-24T08:30:00.000Z",
        "name": "Aarav Sharma",
        "email": "aarav@example.com",
        "status": "active"
      }
    ],
    "nextCursor": null
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 422**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please check the highlighted fields.",
    "fields": [
      {
        "path": "limit",
        "message": "Enter a valid value."
      }
    ]
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-26

**POST /api/v1/guests**

**Access:** S.

**Input rules:** Required UUID clientRequestId, name (1..200), valid email (<=254). Optional duplicateEmailAcknowledged boolean defaults false; resubmit with true only after staff confirm separate guests. Personal link is provisioned but not returned here; no email sent. Changing the acknowledgment after a rejected create is allowed because no successful request was recorded. Successful replay with identical payload returns 200.

**Request and headers**

```http
POST /api/v1/guests HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Content-Type: application/json
Origin: https://wedding.example.invalid
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder; mmm_csrf=signed-placeholder
X-CSRF-Token: csrf-placeholder
```

**JSON request payload**

```json
{
  "clientRequestId": "b75eb112-b544-43ae-a9a2-daf738540a92",
  "name": "Aarav Sharma",
  "email": "aarav@example.com"
}
```

**Success response**

```http
HTTP/1.1 201 Created
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
Location: /api/v1/guests/660000000000000000000002
```

```json
{
  "data": {
    "id": "660000000000000000000002",
    "revision": 1,
    "createdAt": "2026-09-24T08:30:00.000Z",
    "updatedAt": "2026-09-24T08:30:00.000Z",
    "name": "Aarav Sharma",
    "email": "aarav@example.com",
    "status": "active"
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 409**

```json
{
  "error": {
    "code": "DUPLICATE_EMAIL_CONFIRMATION_REQUIRED",
    "message": "Confirm that these are separate guests sharing an email.",
    "details": {
      "matches": [
        {
          "id": "66000000000000000000000c",
          "name": "Another guest"
        }
      ]
    }
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-27

**GET /api/v1/guests/{guestId}**

**Access:** S.

**Input rules:** No request body or query parameters. Standard authorization and ownership checks apply.

**Path parameters:** `guestId`: required 24-character hexadecimal ID.

**Request and headers**

```http
GET /api/v1/guests/660000000000000000000002 HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder
```

**Request payload:** None. Use the query string shown above where applicable.

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "id": "660000000000000000000002",
    "revision": 1,
    "createdAt": "2026-09-24T08:30:00.000Z",
    "updatedAt": "2026-09-24T08:30:00.000Z",
    "name": "Aarav Sharma",
    "email": "aarav@example.com",
    "status": "active"
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 404**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "This record is unavailable."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-28

**PATCH /api/v1/guests/{guestId}**

**Access:** S.

**Input rules:** Required expectedRevision and name and/or email; optional duplicateEmailAcknowledged. Name and email cannot be null. Contact edit preserves RSVPs and invalidates stale queued-email destination snapshots.

**Path parameters:** `guestId`: required 24-character hexadecimal ID.

**Request and headers**

```http
PATCH /api/v1/guests/660000000000000000000002 HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Content-Type: application/json
Origin: https://wedding.example.invalid
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder; mmm_csrf=signed-placeholder
X-CSRF-Token: csrf-placeholder
```

**JSON request payload**

```json
{
  "expectedRevision": 1,
  "email": "aarav.updated@example.com"
}
```

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "id": "660000000000000000000002",
    "revision": 2,
    "createdAt": "2026-09-24T08:30:00.000Z",
    "updatedAt": "2026-09-24T08:30:00.000Z",
    "name": "Aarav Sharma",
    "email": "aarav.updated@example.com",
    "status": "active"
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 409**

```json
{
  "error": {
    "code": "DUPLICATE_EMAIL_CONFIRMATION_REQUIRED",
    "message": "Confirm that these are separate guests sharing an email.",
    "details": {
      "matches": [
        {
          "id": "66000000000000000000000c",
          "name": "Another guest"
        }
      ]
    }
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-29

**DELETE /api/v1/guests/{guestId}**

**Access:** S.

**Input rules:** Soft removal only; preserves history. Blocks personal invitation access and future invitation/reminder dispatch for this guest.

**Path parameters:** `guestId`: required 24-character hexadecimal ID.

**Request and headers**

```http
DELETE /api/v1/guests/660000000000000000000002 HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Content-Type: application/json
Origin: https://wedding.example.invalid
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder; mmm_csrf=signed-placeholder
X-CSRF-Token: csrf-placeholder
If-Match: "1"
```

**Request payload:** None. Send an empty HTTP body; this route does not parse a JSON document.

**Success response**

```http
HTTP/1.1 204 No Content
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
```

No response body.

**Error example — HTTP 409**

```json
{
  "error": {
    "code": "REVISION_CONFLICT",
    "message": "This record changed. Reload it before trying again.",
    "details": {
      "currentRevision": 2
    }
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-30

**GET /api/v1/guests/{guestId}/invitations**

**Access:** S.

**Input rules:** Optional assignmentStatus invited/withdrawn. Optional `limit` integer 1..100 (default 50) and opaque `cursor` string. Omit cursor for the first page; pass the returned nextCursor unchanged for the next page. No total count is implied.

**Path parameters:** `guestId`: required 24-character hexadecimal ID.

**Request and headers**

```http
GET /api/v1/guests/660000000000000000000002/invitations?assignmentStatus=invited&limit=50 HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder
```

**Request payload:** None. Use the query string shown above where applicable.

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "items": [
      {
        "id": "660000000000000000000003",
        "revision": 1,
        "createdAt": "2026-09-24T08:30:00.000Z",
        "updatedAt": "2026-09-24T08:30:00.000Z",
        "eventId": "660000000000000000000001",
        "guestId": "660000000000000000000002",
        "assignmentStatus": "invited",
        "rsvp": {
          "status": "pending",
          "respondedAt": null
        },
        "event": {
          "id": "660000000000000000000001",
          "revision": 1,
          "name": "Ceremony",
          "startsAt": "2027-02-08T04:30:00.000Z",
          "endsAt": "2027-02-08T07:30:00.000Z",
          "venue": {
            "name": "Rose Garden",
            "address": "Example Road, Jaipur",
            "instructions": "Use the main entrance."
          },
          "description": "Join us for the ceremony.",
          "rsvp": {
            "deadlineLocalDate": "2027-02-01",
            "deadlineAt": "2027-02-01T18:29:59.999Z"
          }
        }
      }
    ],
    "nextCursor": null
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 404**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "This record is unavailable."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-31

**GET /api/v1/events/{eventId}/invitations**

**Access:** S.

**Input rules:** Optional assignmentStatus invited/withdrawn, rsvpStatus pending/attending/declined. Returns staff-only guest contacts. Optional `limit` integer 1..100 (default 50) and opaque `cursor` string. Omit cursor for the first page; pass the returned nextCursor unchanged for the next page. No total count is implied.

**Path parameters:** `eventId`: required 24-character hexadecimal ID.

**Request and headers**

```http
GET /api/v1/events/660000000000000000000001/invitations?assignmentStatus=invited&rsvpStatus=pending&limit=50 HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder
```

**Request payload:** None. Use the query string shown above where applicable.

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "items": [
      {
        "id": "660000000000000000000003",
        "revision": 1,
        "createdAt": "2026-09-24T08:30:00.000Z",
        "updatedAt": "2026-09-24T08:30:00.000Z",
        "eventId": "660000000000000000000001",
        "guestId": "660000000000000000000002",
        "assignmentStatus": "invited",
        "rsvp": {
          "status": "pending",
          "respondedAt": null
        },
        "guest": {
          "id": "660000000000000000000002",
          "name": "Aarav Sharma",
          "email": "aarav@example.com"
        }
      }
    ],
    "nextCursor": null
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 422**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please check the highlighted fields.",
    "fields": [
      {
        "path": "rsvpStatus",
        "message": "Enter a valid value."
      }
    ]
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-32

**POST /api/v1/assignment-operations**

**Access:** S.

**Input rules:** Both arrays required, each 1..1,000 distinct IDs from this wedding. This example selects 2 combinations; all-to-all target allows 1,000,000. Add missing pairs only. Existing or withdrawn pairs are not reset. Same-key replay returns the original operation; no emails are sent.

**Request and headers**

```http
POST /api/v1/assignment-operations HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Content-Type: application/json
Origin: https://wedding.example.invalid
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder; mmm_csrf=signed-placeholder
X-CSRF-Token: csrf-placeholder
Idempotency-Key: b75eb112-b544-43ae-a9a2-daf738540a92
```

**JSON request payload**

```json
{
  "guestIds": [
    "660000000000000000000002",
    "66000000000000000000000c"
  ],
  "eventIds": [
    "660000000000000000000001"
  ]
}
```

**Success response**

```http
HTTP/1.1 202 Accepted
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
Location: /api/v1/assignment-operations/660000000000000000000005
```

```json
{
  "data": {
    "id": "660000000000000000000005",
    "kind": "assignment",
    "status": "queued",
    "createdAt": "2026-09-24T08:30:00.000Z",
    "counts": {
      "totalPairs": 2,
      "processedPairs": 0,
      "created": 0,
      "unchanged": 0,
      "skipped": 0,
      "failed": 0
    },
    "statusUrl": "/api/v1/assignment-operations/660000000000000000000005"
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 422**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please check the highlighted fields.",
    "fields": [
      {
        "path": "guestIds",
        "message": "Enter a valid value."
      }
    ]
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-33

**GET /api/v1/assignment-operations/{operationId}**

**Access:** S.

**Input rules:** Counts are committed progress. Poll with backoff; stop on terminal state. Completed records can remain readable after the requesting staff member is revoked, provided the reader is currently authorized staff.

**Path parameters:** `operationId`: required 24-character hexadecimal ID.

**Request and headers**

```http
GET /api/v1/assignment-operations/660000000000000000000005 HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder
```

**Request payload:** None. Use the query string shown above where applicable.

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "id": "660000000000000000000005",
    "kind": "assignment",
    "status": "completed",
    "createdAt": "2026-09-24T08:30:00.000Z",
    "counts": {
      "totalPairs": 2,
      "processedPairs": 2,
      "created": 2,
      "unchanged": 0,
      "skipped": 0,
      "failed": 0
    },
    "statusUrl": "/api/v1/assignment-operations/660000000000000000000005"
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 404**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "This record is unavailable."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-34

**DELETE /api/v1/invitations/{invitationId}**

**Access:** S.

**Input rules:** Withdraw only; preserve answer and scheduled-reminder history. A guest cannot call this staff endpoint.

**Path parameters:** `invitationId`: required 24-character hexadecimal ID.

**Request and headers**

```http
DELETE /api/v1/invitations/660000000000000000000003 HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Content-Type: application/json
Origin: https://wedding.example.invalid
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder; mmm_csrf=signed-placeholder
X-CSRF-Token: csrf-placeholder
If-Match: "1"
```

**Request payload:** None. Send an empty HTTP body; this route does not parse a JSON document.

**Success response**

```http
HTTP/1.1 204 No Content
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
```

No response body.

**Error example — HTTP 409**

```json
{
  "error": {
    "code": "REVISION_CONFLICT",
    "message": "This record changed. Reload it before trying again.",
    "details": {
      "currentRevision": 2
    }
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-35

**POST /api/v1/invitations/{invitationId}/reinstate**

**Access:** S.

**Input rules:** Empty JSON object. Requires an existing withdrawn record and active parent records. Preserves prior RSVP/reminder history rather than resetting it.

**Path parameters:** `invitationId`: required 24-character hexadecimal ID.

**Request and headers**

```http
POST /api/v1/invitations/660000000000000000000003/reinstate HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Content-Type: application/json
Origin: https://wedding.example.invalid
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder; mmm_csrf=signed-placeholder
X-CSRF-Token: csrf-placeholder
If-Match: "1"
```

**JSON request payload**

```json
{}
```

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "id": "660000000000000000000003",
    "revision": 2,
    "createdAt": "2026-09-24T08:30:00.000Z",
    "updatedAt": "2026-09-24T08:30:00.000Z",
    "eventId": "660000000000000000000001",
    "guestId": "660000000000000000000002",
    "assignmentStatus": "invited",
    "rsvp": {
      "status": "pending",
      "respondedAt": null
    }
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 409**

```json
{
  "error": {
    "code": "PARENT_INACTIVE",
    "message": "Activate the guest and event before reinstating the invitation."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-36

**PATCH /api/v1/invitations/{invitationId}/rsvp**

**Access:** S.

**Input rules:** Both fields required. Staff may set pending, attending, or declined. Resetting to pending clears respondedAt in the current response while retaining staff change attribution internally. Does not reset scheduled-reminder history.

**Path parameters:** `invitationId`: required 24-character hexadecimal ID.

**Request and headers**

```http
PATCH /api/v1/invitations/660000000000000000000003/rsvp HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Content-Type: application/json
Origin: https://wedding.example.invalid
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder; mmm_csrf=signed-placeholder
X-CSRF-Token: csrf-placeholder
```

**JSON request payload**

```json
{
  "expectedRevision": 1,
  "status": "attending"
}
```

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "id": "660000000000000000000003",
    "revision": 2,
    "createdAt": "2026-09-24T08:30:00.000Z",
    "updatedAt": "2026-09-24T08:30:00.000Z",
    "eventId": "660000000000000000000001",
    "guestId": "660000000000000000000002",
    "assignmentStatus": "invited",
    "rsvp": {
      "status": "attending",
      "respondedAt": "2026-09-24T08:30:00.000Z"
    }
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 409**

```json
{
  "error": {
    "code": "REVISION_CONFLICT",
    "message": "This record changed. Reload it before trying again.",
    "details": {
      "currentRevision": 2
    }
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-37

**POST /api/v1/email-previews**

**Access:** S for invitation; A for manual_reminder.

**Input rules:** kind invitation or manual_reminder and distinct guestIds[1..1000] required; eventIds[1..1000] optional. Manual reminder requires admin. If no recipient eligible, sample is null and eligibleCount=0; send is rejected with NO_ELIGIBLE_RECIPIENTS. Preview uses safe placeholders for secrets. Example does not send email.

**Request and headers**

```http
POST /api/v1/email-previews HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Content-Type: application/json
Origin: https://wedding.example.invalid
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder; mmm_csrf=signed-placeholder
X-CSRF-Token: csrf-placeholder
```

**JSON request payload**

```json
{
  "kind": "invitation",
  "guestIds": [
    "660000000000000000000002",
    "66000000000000000000000c"
  ],
  "eventIds": [
    "660000000000000000000001"
  ]
}
```

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "kind": "invitation",
    "selectedCount": 2,
    "eligibleCount": 2,
    "skipped": {
      "total": 0,
      "reasons": []
    },
    "sample": {
      "guestId": "660000000000000000000002",
      "subject": "You are invited to our wedding",
      "text": "Aarav, view your invitation: [personal invitation link]",
      "html": "<p>Aarav, view your invitation using your personal link.</p>"
    },
    "previewToken": "signed-preview-placeholder",
    "expiresAt": "2026-09-24T08:40:00.000Z"
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 403**

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "This account cannot perform this action."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-38

**POST /api/v1/email-operations**

**Access:** Same as preview.

**Input rules:** One required actor-bound previewToken. Same-key replay of an already created operation returns it even if its preview subsequently expired; recheck current role first. A new key requires a current preview. Only explicit sends create an operation.

**Request and headers**

```http
POST /api/v1/email-operations HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Content-Type: application/json
Origin: https://wedding.example.invalid
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder; mmm_csrf=signed-placeholder
X-CSRF-Token: csrf-placeholder
Idempotency-Key: b75eb112-b544-43ae-a9a2-daf738540a92
```

**JSON request payload**

```json
{
  "previewToken": "signed-preview-placeholder"
}
```

**Success response**

```http
HTTP/1.1 202 Accepted
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
Location: /api/v1/email-operations/660000000000000000000005
```

```json
{
  "data": {
    "id": "660000000000000000000005",
    "kind": "invitation",
    "status": "queued",
    "createdAt": "2026-09-24T08:30:00.000Z",
    "counts": {
      "total": 2,
      "queued": 2,
      "preparing": 0,
      "ready": 0,
      "dispatching": 0,
      "accepted": 0,
      "delivered": 0,
      "bounced": 0,
      "failed": 0,
      "skipped": 0,
      "uncertain": 0
    },
    "statusUrl": "/api/v1/email-operations/660000000000000000000005"
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 409**

```json
{
  "error": {
    "code": "PREVIEW_STALE",
    "message": "The recipient selection changed. Preview it again."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-39

**GET /api/v1/email-operations**

**Access:** S invitation history; A all permitted kinds.

**Input rules:** kind optional: invitation, manual_reminder, scheduled_reminder. Organizer scope is invitation only, even when kind is omitted; requesting another kind returns 403. Admin can read those three kinds. Account verification/reset/invite messages excluded. Optional `limit` integer 1..100 (default 50) and opaque `cursor` string. Omit cursor for the first page; pass the returned nextCursor unchanged for the next page. No total count is implied.

**Request and headers**

```http
GET /api/v1/email-operations?kind=invitation&limit=50 HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder
```

**Request payload:** None. Use the query string shown above where applicable.

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "items": [
      {
        "id": "660000000000000000000005",
        "kind": "invitation",
        "status": "queued",
        "createdAt": "2026-09-24T08:30:00.000Z",
        "counts": {
          "total": 2,
          "queued": 2,
          "preparing": 0,
          "ready": 0,
          "dispatching": 0,
          "accepted": 0,
          "delivered": 0,
          "bounced": 0,
          "failed": 0,
          "skipped": 0,
          "uncertain": 0
        },
        "statusUrl": "/api/v1/email-operations/660000000000000000000005"
      }
    ],
    "nextCursor": null
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 403**

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "This account cannot perform this action."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-40

**GET /api/v1/email-operations/{operationId}**

**Access:** Same per-kind rule.

**Input rules:** Status completed means dispatch workflow finished, not every email reached an inbox. Counts are mutually exclusive current message states; acceptedAt/deliveredAt facts are separate. Organizer cannot inspect reminder operations by guessing IDs.

**Path parameters:** `operationId`: required 24-character hexadecimal ID.

**Request and headers**

```http
GET /api/v1/email-operations/660000000000000000000005 HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder
```

**Request payload:** None. Use the query string shown above where applicable.

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "id": "660000000000000000000005",
    "kind": "invitation",
    "status": "completed",
    "createdAt": "2026-09-24T08:30:00.000Z",
    "counts": {
      "total": 2,
      "queued": 0,
      "preparing": 0,
      "ready": 0,
      "dispatching": 0,
      "accepted": 1,
      "delivered": 1,
      "bounced": 0,
      "failed": 0,
      "skipped": 0,
      "uncertain": 0
    },
    "statusUrl": "/api/v1/email-operations/660000000000000000000005"
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 403**

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "This account cannot perform this action."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-41

**GET /api/v1/email-operations/{operationId}/messages**

**Access:** Same per-kind rule.

**Input rules:** Optional status: queued/preparing/ready/dispatching/accepted/delivered/bounced/failed/skipped/uncertain. No email body, tokens, or provider credentials returned. Optional `limit` integer 1..100 (default 50) and opaque `cursor` string. Omit cursor for the first page; pass the returned nextCursor unchanged for the next page. No total count is implied.

**Path parameters:** `operationId`: required 24-character hexadecimal ID.

**Request and headers**

```http
GET /api/v1/email-operations/660000000000000000000005/messages?status=failed&limit=50 HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder
```

**Request payload:** None. Use the query string shown above where applicable.

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "items": [
      {
        "id": "66000000000000000000000d",
        "guest": {
          "id": "660000000000000000000002",
          "name": "Aarav Sharma"
        },
        "recipientEmail": "aarav@example.com",
        "status": "failed",
        "acceptedAt": null,
        "deliveredAt": null,
        "bouncedAt": null,
        "lastErrorCode": "PROVIDER_TEMPORARILY_UNAVAILABLE"
      }
    ],
    "nextCursor": null
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 403**

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "This account cannot perform this action."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-42

**POST /api/v1/email-operations/{operationId}/retry**

**Access:** Same per-kind rule.

**Input rules:** Required distinct messageIds, 1..100, all owned by this operation and eligible for safe retry. Reject the whole selection before changing anything if it includes accepted/delivered/uncertain-or-ineligible messages. Never mutate or reorder an already-dispatched batch; reuse a safe existing retry or require reviewed new send.

**Path parameters:** `operationId`: required 24-character hexadecimal ID.

**Request and headers**

```http
POST /api/v1/email-operations/660000000000000000000005/retry HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Content-Type: application/json
Origin: https://wedding.example.invalid
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder; mmm_csrf=signed-placeholder
X-CSRF-Token: csrf-placeholder
Idempotency-Key: b75eb112-b544-43ae-a9a2-daf738540a92
```

**JSON request payload**

```json
{
  "messageIds": [
    "66000000000000000000000d"
  ]
}
```

**Success response**

```http
HTTP/1.1 202 Accepted
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
Location: /api/v1/email-operations/660000000000000000000005
```

```json
{
  "data": {
    "id": "660000000000000000000005",
    "kind": "invitation",
    "status": "sending",
    "createdAt": "2026-09-24T08:30:00.000Z",
    "counts": {
      "total": 2,
      "queued": 2,
      "preparing": 0,
      "ready": 0,
      "dispatching": 0,
      "accepted": 0,
      "delivered": 0,
      "bounced": 0,
      "failed": 0,
      "skipped": 0,
      "uncertain": 0
    },
    "statusUrl": "/api/v1/email-operations/660000000000000000000005"
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 409**

```json
{
  "error": {
    "code": "RETRY_REQUIRES_REVIEW",
    "message": "The previous send outcome must be resolved before retrying."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-43

**POST /api/v1/access/exchange**

**Access:** Link token.

**Input rules:** Both fields required; kind wedding, gallery, or guest_invitation. Same shape for all kinds. Cookies respectively mmm_website, mmm_gallery, mmm_guest with scoped paths. Keep returned nonsecret contextId per tab; recheck source link each request.

**Request and headers**

```http
POST /api/v1/access/exchange HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Content-Type: application/json
Origin: https://wedding.example.invalid
Cookie: mmm_csrf=signed-placeholder
X-CSRF-Token: csrf-placeholder
```

**JSON request payload**

```json
{
  "kind": "guest_invitation",
  "token": "personal-link-placeholder"
}
```

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
Set-Cookie: mmm_guest=encrypted-placeholder; Path=/api/v1/guest; Secure; HttpOnly; SameSite=Lax
```

```json
{
  "data": {
    "contextId": "ctx_personal_example",
    "kind": "guest_invitation",
    "expiresAt": "2026-09-24T20:30:00.000Z"
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 401**

```json
{
  "error": {
    "code": "LINK_UNAVAILABLE",
    "message": "This link is unavailable. Please contact the couple."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-44

**GET /api/v1/sharing**

**Access:** A.

**Input rules:** Only metadata: never tokenDigest, tokenCipher, or recovered URL. Optional `limit` integer 1..100 (default 50) and opaque `cursor` string. Omit cursor for the first page; pass the returned nextCursor unchanged for the next page. No total count is implied.

**Request and headers**

```http
GET /api/v1/sharing?limit=50 HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder
```

**Request payload:** None. Use the query string shown above where applicable.

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "items": [
      {
        "id": "660000000000000000000006",
        "revision": 1,
        "createdAt": "2026-09-24T08:30:00.000Z",
        "updatedAt": "2026-09-24T08:30:00.000Z",
        "kind": "gallery",
        "generation": 1,
        "status": "active",
        "expiresAt": null
      }
    ],
    "nextCursor": null
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 403**

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "This account cannot perform this action."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-45

**POST /api/v1/sharing/links**

**Access:** A.

**Input rules:** kind required: wedding/gallery/guest_invitation. guestId required only for guest_invitation and forbidden otherwise. Creates only when no active link exists. No arbitrary scope, expiry, or role accepted. Response url shape depends on kind. Location points to the existing metadata-list route; use returned id there.

**Request and headers**

```http
POST /api/v1/sharing/links HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Content-Type: application/json
Origin: https://wedding.example.invalid
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder; mmm_csrf=signed-placeholder
X-CSRF-Token: csrf-placeholder
```

**JSON request payload**

```json
{
  "kind": "gallery"
}
```

**Success response**

```http
HTTP/1.1 201 Created
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
Location: /api/v1/sharing?limit=50
```

```json
{
  "data": {
    "id": "660000000000000000000006",
    "revision": 1,
    "createdAt": "2026-09-24T08:30:00.000Z",
    "updatedAt": "2026-09-24T08:30:00.000Z",
    "kind": "gallery",
    "generation": 1,
    "status": "active",
    "expiresAt": null,
    "url": "https://wedding.example.invalid/gallery#token=gallery-placeholder"
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 409**

```json
{
  "error": {
    "code": "ACTIVE_LINK_EXISTS",
    "message": "An active link already exists for this scope."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-46

**POST /api/v1/sharing/links/{linkId}/rotate**

**Access:** A.

**Input rules:** Empty JSON object. Replacement receives its own ID/revision; original is revoked atomically. Existing RSVPs/photos unchanged. Network retry with old revision returns conflict; refresh sharing list rather than rotating again blindly.

**Path parameters:** `linkId`: required 24-character hexadecimal ID.

**Request and headers**

```http
POST /api/v1/sharing/links/660000000000000000000006/rotate HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Content-Type: application/json
Origin: https://wedding.example.invalid
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder; mmm_csrf=signed-placeholder
X-CSRF-Token: csrf-placeholder
If-Match: "1"
```

**JSON request payload**

```json
{}
```

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "id": "660000000000000000000010",
    "revision": 1,
    "createdAt": "2026-09-24T08:30:00.000Z",
    "updatedAt": "2026-09-24T08:30:00.000Z",
    "kind": "gallery",
    "generation": 2,
    "status": "active",
    "expiresAt": null,
    "url": "https://wedding.example.invalid/gallery#token=replacement-gallery-placeholder"
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 409**

```json
{
  "error": {
    "code": "REVISION_CONFLICT",
    "message": "This record changed. Reload it before trying again.",
    "details": {
      "currentRevision": 2
    }
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-47

**DELETE /api/v1/sharing/links/{linkId}**

**Access:** A.

**Input rules:** Revokes the link and source access for existing browser cookies; does not delete wedding/RSVP/photo records.

**Path parameters:** `linkId`: required 24-character hexadecimal ID.

**Request and headers**

```http
DELETE /api/v1/sharing/links/660000000000000000000006 HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Content-Type: application/json
Origin: https://wedding.example.invalid
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder; mmm_csrf=signed-placeholder
X-CSRF-Token: csrf-placeholder
If-Match: "1"
```

**Request payload:** None. Send an empty HTTP body; this route does not parse a JSON document.

**Success response**

```http
HTTP/1.1 204 No Content
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
```

No response body.

**Error example — HTTP 409**

```json
{
  "error": {
    "code": "REVISION_CONFLICT",
    "message": "This record changed. Reload it before trying again.",
    "details": {
      "currentRevision": 2
    }
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-48

**GET /api/v1/sharing/gallery**

**Access:** S.

**Input rules:** Optional eventId must identify a shared album. Omitting it returns the general gallery URL/QR. Copies the active link only; never reactivates it.

**Request and headers**

```http
GET /api/v1/sharing/gallery?eventId=660000000000000000000001 HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder
```

**Request payload:** None. Use the query string shown above where applicable.

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "url": "https://wedding.example.invalid/gallery?eventId=660000000000000000000001#token=gallery-placeholder",
    "qrImageUrl": "https://wedding.example.invalid/api/v1/sharing/qr?token=gallery-placeholder&eventId=660000000000000000000001"
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 409**

```json
{
  "error": {
    "code": "LINK_NOT_ACTIVE",
    "message": "An admin must create an active gallery link."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-49

**GET /api/v1/sharing/wedding**

**Access:** A.

**Input rules:** No request body or query parameters. Standard authorization and ownership checks apply.

**Request and headers**

```http
GET /api/v1/sharing/wedding HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder
```

**Request payload:** None. Use the query string shown above where applicable.

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "url": "https://wedding.example.invalid/wedding#token=wedding-placeholder"
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 409**

```json
{
  "error": {
    "code": "LINK_NOT_ACTIVE",
    "message": "An admin must create an active wedding link."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-50

**GET /api/v1/guests/{guestId}/invitation-link**

**Access:** S.

**Input rules:** Staff only. Guest must be active. Copies only this guest’s existing active URL; no email is sent.

**Path parameters:** `guestId`: required 24-character hexadecimal ID.

**Request and headers**

```http
GET /api/v1/guests/660000000000000000000002/invitation-link HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder
```

**Request payload:** None. Use the query string shown above where applicable.

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "url": "https://wedding.example.invalid/invite#token=personal-placeholder"
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 409**

```json
{
  "error": {
    "code": "LINK_NOT_ACTIVE",
    "message": "An admin must create an active personal invitation link."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-51

**GET /api/v1/sharing/qr**

**Access:** Gallery bearer token.

**Input rules:** Required gallery token; optional eventId. Success bytes are PNG, not JSON. No cookie or CSRF needed for this read, but token validation/rate limiting still apply. Query is sensitive and must be redacted. Token cannot be a personal RSVP token.

**Request and headers**

```http
GET /api/v1/sharing/qr?token=gallery-placeholder&eventId=660000000000000000000001 HTTP/1.1
Host: wedding.example.invalid
Accept: image/png
```

**Request payload:** None. Use the query string shown above where applicable.

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: image/png
```

Binary PNG image bytes; there is no JSON success payload.

**Error example — HTTP 401**

```json
{
  "error": {
    "code": "LINK_UNAVAILABLE",
    "message": "This link is unavailable. Please contact the couple."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-52

**GET /api/v1/guest/invitation**

**Access:** Personal Link.

**Input rules:** Only the display identity of the current capability. No email directory, guestId input, or other personal invitations.

**Request and headers**

```http
GET /api/v1/guest/invitation HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Cookie: mmm_guest=guest-access-placeholder
X-Access-Context: ctx_personal_example
```

**Request payload:** None. Use the query string shown above where applicable.

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "guest": {
      "name": "Aarav Sharma"
    },
    "wedding": {
      "couple": {
        "partnerOneName": "Anaya",
        "partnerTwoName": "Rohan"
      },
      "weddingDate": "2027-02-08",
      "timeZone": "Asia/Kolkata"
    },
    "galleryUrl": "https://wedding.example.invalid/gallery#token=gallery-placeholder",
    "contextId": "ctx_personal_example"
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 401**

```json
{
  "error": {
    "code": "LINK_UNAVAILABLE",
    "message": "This link is unavailable. Please contact the couple."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-53

**GET /api/v1/guest/invitation/events**

**Access:** Personal Link.

**Input rules:** Only this link’s active assigned events. No guestId query accepted. Optional `limit` integer 1..100 (default 50) and opaque `cursor` string. Omit cursor for the first page; pass the returned nextCursor unchanged for the next page. No total count is implied.

**Request and headers**

```http
GET /api/v1/guest/invitation/events?limit=50 HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Cookie: mmm_guest=guest-access-placeholder
X-Access-Context: ctx_personal_example
```

**Request payload:** None. Use the query string shown above where applicable.

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "items": [
      {
        "id": "660000000000000000000001",
        "revision": 1,
        "name": "Ceremony",
        "startsAt": "2027-02-08T04:30:00.000Z",
        "endsAt": "2027-02-08T07:30:00.000Z",
        "venue": {
          "name": "Rose Garden",
          "address": "Example Road, Jaipur",
          "instructions": "Use the main entrance."
        },
        "description": "Join us for the ceremony.",
        "rsvp": {
          "deadlineLocalDate": "2027-02-01",
          "deadlineAt": "2027-02-01T18:29:59.999Z"
        },
        "invitation": {
          "id": "660000000000000000000003",
          "revision": 1,
          "eventId": "660000000000000000000001",
          "assignmentStatus": "invited",
          "rsvp": {
            "status": "pending",
            "respondedAt": null
          }
        }
      }
    ],
    "nextCursor": null
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 401**

```json
{
  "error": {
    "code": "LINK_UNAVAILABLE",
    "message": "This link is unavailable. Please contact the couple."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-54

**PATCH /api/v1/guest/invitations/{invitationId}/rsvp**

**Access:** Personal Link.

**Input rules:** Both fields required. status only attending/declined. Do not send guestId/eventId/role; owner is resolved from link. A valid link targeting another guest’s invitation returns 404. No guest reset-to-pending action.

**Path parameters:** `invitationId`: required 24-character hexadecimal ID.

**Request and headers**

```http
PATCH /api/v1/guest/invitations/660000000000000000000003/rsvp HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Content-Type: application/json
Origin: https://wedding.example.invalid
Cookie: mmm_guest=guest-access-placeholder; mmm_csrf=signed-placeholder
X-Access-Context: ctx_personal_example
X-CSRF-Token: csrf-placeholder
```

**JSON request payload**

```json
{
  "expectedRevision": 1,
  "status": "attending"
}
```

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "id": "660000000000000000000003",
    "revision": 2,
    "eventId": "660000000000000000000001",
    "assignmentStatus": "invited",
    "rsvp": {
      "status": "attending",
      "respondedAt": "2026-09-24T08:30:00.000Z"
    }
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 404**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "This record is unavailable."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-55

**GET /api/v1/website**

**Access:** Wedding Link or S.

**Input rules:** Example uses a wedding capability. Staff may instead use their staff cookie without X-Access-Context. Images are ready website-purpose URLs with expiry; images array empty in this example. No private schedule or guest contacts.

**Request and headers**

```http
GET /api/v1/website HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Cookie: mmm_website=website-access-placeholder
X-Access-Context: ctx_website_example
```

**Request payload:** None. Use the query string shown above where applicable.

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "couple": {
      "partnerOneName": "Anaya",
      "partnerTwoName": "Rohan"
    },
    "weddingDate": "2027-02-08",
    "timeZone": "Asia/Kolkata",
    "story": "We look forward to celebrating with you.",
    "venue": {
      "name": "Rose Garden",
      "address": "Example Road, Jaipur",
      "instructions": "Use the main entrance."
    },
    "template": "elegant_floral",
    "images": [],
    "youtubeVideoId": null,
    "galleryUrl": "https://wedding.example.invalid/gallery#token=gallery-placeholder"
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 401**

```json
{
  "error": {
    "code": "LINK_UNAVAILABLE",
    "message": "This link is unavailable. Please contact the couple."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-56

**GET /api/v1/website/events**

**Access:** Wedding Link or S.

**Input rules:** Only active events explicitly marked wedding_link. Example event details are shown only when that visibility is enabled. Optional `limit` integer 1..100 (default 50) and opaque `cursor` string. Omit cursor for the first page; pass the returned nextCursor unchanged for the next page. No total count is implied.

**Request and headers**

```http
GET /api/v1/website/events?limit=50 HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Cookie: mmm_website=website-access-placeholder
X-Access-Context: ctx_website_example
```

**Request payload:** None. Use the query string shown above where applicable.

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "items": [
      {
        "id": "660000000000000000000001",
        "revision": 1,
        "name": "Ceremony",
        "startsAt": "2027-02-08T04:30:00.000Z",
        "endsAt": "2027-02-08T07:30:00.000Z",
        "venue": {
          "name": "Rose Garden",
          "address": "Example Road, Jaipur",
          "instructions": "Use the main entrance."
        },
        "description": "Join us for the ceremony.",
        "rsvp": {
          "deadlineLocalDate": "2027-02-01",
          "deadlineAt": "2027-02-01T18:29:59.999Z"
        }
      }
    ],
    "nextCursor": null
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 401**

```json
{
  "error": {
    "code": "LINK_UNAVAILABLE",
    "message": "This link is unavailable. Please contact the couple."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-57

**GET /api/v1/gallery/albums**

**Access:** Gallery Link or S.

**Input rules:** No private event times, locations, RSVP counts, or contact information. Staff may use staff cookies instead. Optional `limit` integer 1..100 (default 50) and opaque `cursor` string. Omit cursor for the first page; pass the returned nextCursor unchanged for the next page. No total count is implied.

**Request and headers**

```http
GET /api/v1/gallery/albums?limit=50 HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Cookie: mmm_gallery=gallery-access-placeholder
X-Access-Context: ctx_gallery_example
```

**Request payload:** None. Use the query string shown above where applicable.

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "items": [
      {
        "eventId": "660000000000000000000001",
        "name": "Ceremony",
        "acceptedPhotoCount": 24,
        "uploadsAllowed": true
      }
    ],
    "nextCursor": null
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 401**

```json
{
  "error": {
    "code": "LINK_UNAVAILABLE",
    "message": "This link is unavailable. Please contact the couple."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-58

**GET /api/v1/gallery/albums/{eventId}/photos**

**Access:** Gallery Link or S.

**Input rules:** Only accepted gallery-purpose photos; no pending/deleting/deleted entries. Optional `limit` integer 1..100 (default 50) and opaque `cursor` string. Omit cursor for the first page; pass the returned nextCursor unchanged for the next page. No total count is implied.

**Path parameters:** `eventId`: required 24-character hexadecimal ID.

**Request and headers**

```http
GET /api/v1/gallery/albums/660000000000000000000001/photos?limit=50 HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Cookie: mmm_gallery=gallery-access-placeholder
X-Access-Context: ctx_gallery_example
```

**Request payload:** None. Use the query string shown above where applicable.

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "items": [
      {
        "id": "660000000000000000000007",
        "revision": 1,
        "createdAt": "2026-09-24T08:30:00.000Z",
        "updatedAt": "2026-09-24T08:30:00.000Z",
        "eventId": "660000000000000000000001",
        "status": "accepted",
        "processingStatus": "ready",
        "width": 4032,
        "height": 3024,
        "displayName": "ceremony.jpg",
        "thumbnailUrl": "https://storage.example.invalid/thumb?signature=placeholder",
        "previewUrl": "https://storage.example.invalid/preview?signature=placeholder",
        "urlsExpireAt": "2026-09-24T08:35:00.000Z"
      }
    ],
    "nextCursor": null
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 404**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "This record is unavailable."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-59

**GET /api/v1/gallery/photos/{photoId}**

**Access:** Gallery Link or S.

**Input rules:** Accepted photos are visible to gallery holders. Pending/failed upload details require initiating staff/link scope or admin. Until accepted, omit dimensions/URLs not yet known. Deleting/deleted state visible only to admin or initiating scope. Website images are not accessible by this route.

**Path parameters:** `photoId`: required 24-character hexadecimal ID.

**Request and headers**

```http
GET /api/v1/gallery/photos/660000000000000000000007 HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Cookie: mmm_gallery=gallery-access-placeholder
X-Access-Context: ctx_gallery_example
```

**Request payload:** None. Use the query string shown above where applicable.

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "id": "660000000000000000000007",
    "revision": 1,
    "createdAt": "2026-09-24T08:30:00.000Z",
    "updatedAt": "2026-09-24T08:30:00.000Z",
    "eventId": "660000000000000000000001",
    "status": "accepted",
    "processingStatus": "ready",
    "width": 4032,
    "height": 3024,
    "displayName": "ceremony.jpg",
    "thumbnailUrl": "https://storage.example.invalid/thumb?signature=placeholder",
    "previewUrl": "https://storage.example.invalid/preview?signature=placeholder",
    "urlsExpireAt": "2026-09-24T08:35:00.000Z"
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 404**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "This record is unavailable."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-60

**POST /api/v1/gallery/uploads**

**Access:** Gallery Link or S.

**Input rules:** Required selectionId UUID and files[1..20]; eventId required and must permit uploads. Each descriptor requires clientFileId (1..100 characters, unique within selection), name (1..255), sizeBytes integer 1..50,000,000, supported contentType. Allowed MIME: image/jpeg, image/png, image/heic, image/heif; actual signature/decoder is checked later. No file bytes in this JSON. The example has one file; batch returns one result per accepted descriptor. Matching retries return existing photo IDs; renew expired PUT URLs separately.

**Request and headers**

```http
POST /api/v1/gallery/uploads HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Content-Type: application/json
Origin: https://wedding.example.invalid
Cookie: mmm_gallery=gallery-access-placeholder; mmm_csrf=signed-placeholder
X-Access-Context: ctx_gallery_example
X-CSRF-Token: csrf-placeholder
Idempotency-Key: b75eb112-b544-43ae-a9a2-daf738540a92
```

**JSON request payload**

```json
{
  "eventId": "660000000000000000000001",
  "selectionId": "a8f5518a-6436-4b0e-943e-8d82dc405093",
  "files": [
    {
      "clientFileId": "file-1",
      "name": "ceremony.jpg",
      "sizeBytes": 4200000,
      "contentType": "image/jpeg"
    }
  ]
}
```

**Success response**

```http
HTTP/1.1 201 Created
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
Location: /api/v1/gallery/photos/660000000000000000000007
```

```json
{
  "data": {
    "selectionId": "a8f5518a-6436-4b0e-943e-8d82dc405093",
    "files": [
      {
        "clientFileId": "file-1",
        "photoId": "660000000000000000000007",
        "upload": {
          "method": "PUT",
          "url": "https://storage.example.invalid/staging?signature=placeholder",
          "headers": {
            "Content-Type": "image/jpeg"
          },
          "expiresAt": "2026-09-24T08:45:00.000Z"
        }
      }
    ]
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 422**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please check the highlighted fields.",
    "fields": [
      {
        "path": "files.0.sizeBytes",
        "message": "Enter a valid value."
      }
    ]
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-61

**POST /api/v1/gallery/uploads/{photoId}/renew**

**Access:** Initiating scope or A.

**Input rules:** Empty JSON object. Only initiating scope or admin (website always admin), active capability required. Pending asset must still be eligible. Does not create a second photo.

**Path parameters:** `photoId`: required 24-character hexadecimal ID.

**Request and headers**

```http
POST /api/v1/gallery/uploads/660000000000000000000007/renew HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Content-Type: application/json
Origin: https://wedding.example.invalid
Cookie: mmm_gallery=gallery-access-placeholder; mmm_csrf=signed-placeholder
X-Access-Context: ctx_gallery_example
X-CSRF-Token: csrf-placeholder
```

**JSON request payload**

```json
{}
```

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "photoId": "660000000000000000000007",
    "upload": {
      "method": "PUT",
      "url": "https://storage.example.invalid/staging?signature=placeholder",
      "headers": {
        "Content-Type": "image/jpeg"
      },
      "expiresAt": "2026-09-24T08:45:00.000Z"
    }
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 409**

```json
{
  "error": {
    "code": "UPLOAD_NOT_PENDING",
    "message": "This upload can no longer receive a new upload URL."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-62

**POST /api/v1/gallery/uploads/{photoId}/complete**

**Access:** Initiating scope or A.

**Input rules:** Empty JSON object, no object key or remote URL. Verifies the server-assigned staging object and queues validation/processing. 202 while in progress; repeated request returns 200 if already accepted. Invalid actual image later appears as rejected status with a safe failure code, not false upload success.

**Path parameters:** `photoId`: required 24-character hexadecimal ID.

**Request and headers**

```http
POST /api/v1/gallery/uploads/660000000000000000000007/complete HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Content-Type: application/json
Origin: https://wedding.example.invalid
Cookie: mmm_gallery=gallery-access-placeholder; mmm_csrf=signed-placeholder
X-Access-Context: ctx_gallery_example
X-CSRF-Token: csrf-placeholder
```

**JSON request payload**

```json
{}
```

**Success response**

```http
HTTP/1.1 202 Accepted
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
Location: /api/v1/gallery/photos/660000000000000000000007
```

```json
{
  "data": {
    "id": "660000000000000000000007",
    "revision": 1,
    "createdAt": "2026-09-24T08:30:00.000Z",
    "updatedAt": "2026-09-24T08:30:00.000Z",
    "eventId": "660000000000000000000001",
    "status": "validating",
    "processingStatus": "queued",
    "displayName": "ceremony.jpg",
    "statusUrl": "/api/v1/gallery/photos/660000000000000000000007"
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 409**

```json
{
  "error": {
    "code": "UPLOAD_NOT_FOUND_IN_STORAGE",
    "message": "Upload the file before completing it."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-63

**POST /api/v1/gallery/photos/{photoId}/download**

**Access:** Gallery Link or S.

**Input rules:** Empty JSON object. Returns a five-minute temporary GET URL for unchanged original bytes after current access/state checks. A browser then downloads from R2, not this JSON endpoint.

**Path parameters:** `photoId`: required 24-character hexadecimal ID.

**Request and headers**

```http
POST /api/v1/gallery/photos/660000000000000000000007/download HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Content-Type: application/json
Origin: https://wedding.example.invalid
Cookie: mmm_gallery=gallery-access-placeholder; mmm_csrf=signed-placeholder
X-Access-Context: ctx_gallery_example
X-CSRF-Token: csrf-placeholder
```

**JSON request payload**

```json
{}
```

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "url": "https://storage.example.invalid/original?signature=placeholder",
    "expiresAt": "2026-09-24T08:35:00.000Z",
    "filename": "ceremony.jpg"
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 404**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "This record is unavailable."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-64

**DELETE /api/v1/gallery/photos/{photoId}**

**Access:** A.

**Input rules:** Admin only. 202 after durable deletion request, with original and variants removed in background. The example had ready previews before deletion; status=deleting overrides browsing availability regardless of processingStatus. Matching repeated deletion returns current deletion state; a completed deletion can return 200 deleted. No photo removed by guest or organizer.

**Path parameters:** `photoId`: required 24-character hexadecimal ID.

**Request and headers**

```http
DELETE /api/v1/gallery/photos/660000000000000000000007 HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Content-Type: application/json
Origin: https://wedding.example.invalid
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder; mmm_csrf=signed-placeholder
X-CSRF-Token: csrf-placeholder
If-Match: "1"
```

**Request payload:** None. Send an empty HTTP body; this route does not parse a JSON document.

**Success response**

```http
HTTP/1.1 202 Accepted
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
Location: /api/v1/gallery/photos/660000000000000000000007
```

```json
{
  "data": {
    "id": "660000000000000000000007",
    "revision": 2,
    "createdAt": "2026-09-24T08:30:00.000Z",
    "updatedAt": "2026-09-24T08:30:00.000Z",
    "eventId": "660000000000000000000001",
    "status": "deleting",
    "processingStatus": "ready",
    "displayName": "ceremony.jpg",
    "statusUrl": "/api/v1/gallery/photos/660000000000000000000007"
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 403**

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "This account cannot perform this action."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-65

**POST /api/v1/website-images/uploads**

**Access:** A.

**Input rules:** Required selectionId UUID and files[1..20]; eventId is forbidden; admin only. Each descriptor requires clientFileId (1..100 characters, unique within selection), name (1..255), sizeBytes integer 1..50,000,000, supported contentType. Allowed MIME: image/jpeg, image/png, image/heic, image/heif; actual signature/decoder is checked later. No file bytes in this JSON. The example has one file; batch returns one result per accepted descriptor. Matching retries return existing photo IDs; renew expired PUT URLs separately.

**Request and headers**

```http
POST /api/v1/website-images/uploads HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Content-Type: application/json
Origin: https://wedding.example.invalid
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder; mmm_csrf=signed-placeholder
X-CSRF-Token: csrf-placeholder
Idempotency-Key: b75eb112-b544-43ae-a9a2-daf738540a92
```

**JSON request payload**

```json
{
  "selectionId": "a8f5518a-6436-4b0e-943e-8d82dc405093",
  "files": [
    {
      "clientFileId": "file-1",
      "name": "ceremony.jpg",
      "sizeBytes": 4200000,
      "contentType": "image/jpeg"
    }
  ]
}
```

**Success response**

```http
HTTP/1.1 201 Created
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
Location: /api/v1/website-images/660000000000000000000007
```

```json
{
  "data": {
    "selectionId": "a8f5518a-6436-4b0e-943e-8d82dc405093",
    "files": [
      {
        "clientFileId": "file-1",
        "photoId": "660000000000000000000007",
        "upload": {
          "method": "PUT",
          "url": "https://storage.example.invalid/staging?signature=placeholder",
          "headers": {
            "Content-Type": "image/jpeg"
          },
          "expiresAt": "2026-09-24T08:45:00.000Z"
        }
      }
    ]
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 422**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please check the highlighted fields.",
    "fields": [
      {
        "path": "files.0.sizeBytes",
        "message": "Enter a valid value."
      }
    ]
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-66

**GET /api/v1/website-images/{photoId}**

**Access:** A.

**Input rules:** Admin only. Purpose must be website. Response eventId is absent. Status and preview URLs appear as processing progresses; common gallery link does not grant access.

**Path parameters:** `photoId`: required 24-character hexadecimal ID.

**Request and headers**

```http
GET /api/v1/website-images/660000000000000000000007 HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder
```

**Request payload:** None. Use the query string shown above where applicable.

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "id": "660000000000000000000007",
    "revision": 1,
    "createdAt": "2026-09-24T08:30:00.000Z",
    "updatedAt": "2026-09-24T08:30:00.000Z",
    "status": "validating",
    "processingStatus": "queued",
    "displayName": "ceremony.jpg",
    "statusUrl": "/api/v1/website-images/660000000000000000000007"
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 404**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "This record is unavailable."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-67

**POST /api/v1/website-images/{photoId}/renew**

**Access:** A.

**Input rules:** Empty JSON object. Only initiating scope or admin (website always admin), active capability required. Pending asset must still be eligible. Does not create a second photo.

**Path parameters:** `photoId`: required 24-character hexadecimal ID.

**Request and headers**

```http
POST /api/v1/website-images/660000000000000000000007/renew HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Content-Type: application/json
Origin: https://wedding.example.invalid
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder; mmm_csrf=signed-placeholder
X-CSRF-Token: csrf-placeholder
```

**JSON request payload**

```json
{}
```

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "photoId": "660000000000000000000007",
    "upload": {
      "method": "PUT",
      "url": "https://storage.example.invalid/staging?signature=placeholder",
      "headers": {
        "Content-Type": "image/jpeg"
      },
      "expiresAt": "2026-09-24T08:45:00.000Z"
    }
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 409**

```json
{
  "error": {
    "code": "UPLOAD_NOT_PENDING",
    "message": "This upload can no longer receive a new upload URL."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-68

**POST /api/v1/website-images/{photoId}/complete**

**Access:** A.

**Input rules:** Empty JSON object, no object key or remote URL. Verifies the server-assigned staging object and queues validation/processing. 202 while in progress; repeated request returns 200 if already accepted. Invalid actual image later appears as rejected status with a safe failure code, not false upload success.

**Path parameters:** `photoId`: required 24-character hexadecimal ID.

**Request and headers**

```http
POST /api/v1/website-images/660000000000000000000007/complete HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Content-Type: application/json
Origin: https://wedding.example.invalid
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder; mmm_csrf=signed-placeholder
X-CSRF-Token: csrf-placeholder
```

**JSON request payload**

```json
{}
```

**Success response**

```http
HTTP/1.1 202 Accepted
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
Location: /api/v1/website-images/660000000000000000000007
```

```json
{
  "data": {
    "id": "660000000000000000000007",
    "revision": 1,
    "createdAt": "2026-09-24T08:30:00.000Z",
    "updatedAt": "2026-09-24T08:30:00.000Z",
    "status": "validating",
    "processingStatus": "queued",
    "displayName": "ceremony.jpg",
    "statusUrl": "/api/v1/website-images/660000000000000000000007"
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 409**

```json
{
  "error": {
    "code": "UPLOAD_NOT_FOUND_IN_STORAGE",
    "message": "Upload the file before completing it."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-69

**DELETE /api/v1/website-images/{photoId}**

**Access:** A.

**Input rules:** Admin only. 202 after durable deletion request, with original and variants removed in background. The example had ready previews before deletion; status=deleting overrides browsing availability regardless of processingStatus. Matching repeated deletion returns current deletion state; a completed deletion can return 200 deleted. No photo removed by guest or organizer.

**Path parameters:** `photoId`: required 24-character hexadecimal ID.

**Request and headers**

```http
DELETE /api/v1/website-images/660000000000000000000007 HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Content-Type: application/json
Origin: https://wedding.example.invalid
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder; mmm_csrf=signed-placeholder
X-CSRF-Token: csrf-placeholder
If-Match: "1"
```

**Request payload:** None. Send an empty HTTP body; this route does not parse a JSON document.

**Success response**

```http
HTTP/1.1 202 Accepted
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
Location: /api/v1/website-images/660000000000000000000007
```

```json
{
  "data": {
    "id": "660000000000000000000007",
    "revision": 2,
    "createdAt": "2026-09-24T08:30:00.000Z",
    "updatedAt": "2026-09-24T08:30:00.000Z",
    "status": "deleting",
    "processingStatus": "ready",
    "displayName": "ceremony.jpg",
    "statusUrl": "/api/v1/website-images/660000000000000000000007"
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 409**

```json
{
  "error": {
    "code": "ASSET_IN_USE",
    "message": "Remove this image from website content before deleting it."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-70

**GET /api/v1/expenses**

**Access:** A.

**Input rules:** Optional eventId and category literal string (1..100). Optional `limit` integer 1..100 (default 50) and opaque `cursor` string. Omit cursor for the first page; pass the returned nextCursor unchanged for the next page. No total count is implied.

**Request and headers**

```http
GET /api/v1/expenses?eventId=660000000000000000000001&category=decor&limit=50 HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder
```

**Request payload:** None. Use the query string shown above where applicable.

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "items": [
      {
        "id": "660000000000000000000008",
        "revision": 1,
        "createdAt": "2026-09-24T08:30:00.000Z",
        "updatedAt": "2026-09-24T08:30:00.000Z",
        "description": "Flower decoration",
        "category": "decor",
        "eventId": "660000000000000000000001",
        "currency": "INR",
        "currencyMinorUnit": 2,
        "costMinor": "125050",
        "paidMinor": "50000",
        "outstandingMinor": "75050",
        "paymentStatus": "partially_paid",
        "notes": "Balance due after the event."
      }
    ],
    "nextCursor": null
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 403**

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "This account cannot perform this action."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-71

**POST /api/v1/expenses**

**Access:** A.

**Input rules:** Required clientRequestId UUID, description (1..2,000), category (1..100), costMinor and paidMinor decimal integer strings >=0. Optional eventId and notes <=2,000. Currency/currencyMinorUnit are server-derived. Reject exponent/decimal/negative strings and overflow; paid<=cost. Matching create replay returns 200.

**Request and headers**

```http
POST /api/v1/expenses HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Content-Type: application/json
Origin: https://wedding.example.invalid
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder; mmm_csrf=signed-placeholder
X-CSRF-Token: csrf-placeholder
```

**JSON request payload**

```json
{
  "clientRequestId": "b75eb112-b544-43ae-a9a2-daf738540a92",
  "description": "Flower decoration",
  "category": "decor",
  "costMinor": "125050",
  "paidMinor": "50000",
  "eventId": "660000000000000000000001",
  "notes": "Balance due after the event."
}
```

**Success response**

```http
HTTP/1.1 201 Created
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
Location: /api/v1/expenses/660000000000000000000008
```

```json
{
  "data": {
    "id": "660000000000000000000008",
    "revision": 1,
    "createdAt": "2026-09-24T08:30:00.000Z",
    "updatedAt": "2026-09-24T08:30:00.000Z",
    "description": "Flower decoration",
    "category": "decor",
    "eventId": "660000000000000000000001",
    "currency": "INR",
    "currencyMinorUnit": 2,
    "costMinor": "125050",
    "paidMinor": "50000",
    "outstandingMinor": "75050",
    "paymentStatus": "partially_paid",
    "notes": "Balance due after the event."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 422**

```json
{
  "error": {
    "code": "PAYMENT_EXCEEDS_COST",
    "message": "Amount paid cannot exceed the total cost."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-72

**GET /api/v1/expenses/{expenseId}**

**Access:** A.

**Input rules:** No request body or query parameters. Standard authorization and ownership checks apply.

**Path parameters:** `expenseId`: required 24-character hexadecimal ID.

**Request and headers**

```http
GET /api/v1/expenses/660000000000000000000008 HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder
```

**Request payload:** None. Use the query string shown above where applicable.

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "id": "660000000000000000000008",
    "revision": 1,
    "createdAt": "2026-09-24T08:30:00.000Z",
    "updatedAt": "2026-09-24T08:30:00.000Z",
    "description": "Flower decoration",
    "category": "decor",
    "eventId": "660000000000000000000001",
    "currency": "INR",
    "currencyMinorUnit": 2,
    "costMinor": "125050",
    "paidMinor": "50000",
    "outstandingMinor": "75050",
    "paymentStatus": "partially_paid",
    "notes": "Balance due after the event."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 403**

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "This account cannot perform this action."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-73

**PATCH /api/v1/expenses/{expenseId}**

**Access:** A.

**Input rules:** Required expectedRevision and at least one of description/category/costMinor/paidMinor/eventId/notes. Same create validation against resulting whole record. eventId/notes may be null to clear; currency and derived outstanding/paymentStatus forbidden.

**Path parameters:** `expenseId`: required 24-character hexadecimal ID.

**Request and headers**

```http
PATCH /api/v1/expenses/660000000000000000000008 HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Content-Type: application/json
Origin: https://wedding.example.invalid
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder; mmm_csrf=signed-placeholder
X-CSRF-Token: csrf-placeholder
```

**JSON request payload**

```json
{
  "expectedRevision": 1,
  "paidMinor": "125050"
}
```

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "id": "660000000000000000000008",
    "revision": 2,
    "createdAt": "2026-09-24T08:30:00.000Z",
    "updatedAt": "2026-09-24T08:30:00.000Z",
    "description": "Flower decoration",
    "category": "decor",
    "eventId": "660000000000000000000001",
    "currency": "INR",
    "currencyMinorUnit": 2,
    "costMinor": "125050",
    "paidMinor": "125050",
    "outstandingMinor": "0",
    "paymentStatus": "paid",
    "notes": "Balance due after the event."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 422**

```json
{
  "error": {
    "code": "PAYMENT_EXCEEDS_COST",
    "message": "Amount paid cannot exceed the total cost."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-74

**DELETE /api/v1/expenses/{expenseId}**

**Access:** A.

**Input rules:** Admin-only soft deletion; excluded from subsequent totals. No payment transaction or refund is performed.

**Path parameters:** `expenseId`: required 24-character hexadecimal ID.

**Request and headers**

```http
DELETE /api/v1/expenses/660000000000000000000008 HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Content-Type: application/json
Origin: https://wedding.example.invalid
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder; mmm_csrf=signed-placeholder
X-CSRF-Token: csrf-placeholder
If-Match: "1"
```

**Request payload:** None. Send an empty HTTP body; this route does not parse a JSON document.

**Success response**

```http
HTTP/1.1 204 No Content
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
```

No response body.

**Error example — HTTP 409**

```json
{
  "error": {
    "code": "REVISION_CONFLICT",
    "message": "This record changed. Reload it before trying again.",
    "details": {
      "currentRevision": 2
    }
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-75

**GET /api/v1/expenses/summary**

**Access:** A.

**Input rules:** Optional eventId; omit for wedding-wide active expenses. All amount fields are exact minor-unit strings; organizer receives 403, never a redacted financial summary.

**Request and headers**

```http
GET /api/v1/expenses/summary?eventId=660000000000000000000001 HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder
```

**Request payload:** None. Use the query string shown above where applicable.

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "currency": "INR",
    "currencyMinorUnit": 2,
    "totalCostMinor": "125050",
    "paidMinor": "50000",
    "outstandingMinor": "75050"
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 403**

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "This account cannot perform this action."
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

### endpoint-76

**GET /api/v1/planners**

**Access:** S.

**Input rules:** Optional q/area <=100 characters; literal sample-data matching, not GPS distance. No unverified contact or real booking availability in example. Fixture IDs are not MongoDB ObjectIds. Optional `limit` integer 1..100 (default 50) and opaque `cursor` string. Omit cursor for the first page; pass the returned nextCursor unchanged for the next page. No total count is implied.

**Request and headers**

```http
GET /api/v1/planners?q=Floral&area=Jaipur&limit=50 HTTP/1.1
Host: wedding.example.invalid
Accept: application/json
Cookie: AUTHJS_SESSION_COOKIE=staff-session-placeholder
```

**Request payload:** None. Use the query string shown above where applicable.

**Success response**

```http
HTTP/1.1 200 OK
X-Request-ID: req_example
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Content-Type: application/json
```

```json
{
  "data": {
    "items": [
      {
        "id": "sample-planner-001",
        "name": "Example Floral Planners",
        "area": "Jaipur",
        "services": [
          "Decoration",
          "Event coordination"
        ],
        "description": "Fictional listing for demonstration.",
        "isSample": true
      }
    ],
    "nextCursor": null,
    "isSample": true
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

**Error example — HTTP 422**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please check the highlighted fields.",
    "fields": [
      {
        "path": "limit",
        "message": "Enter a valid value."
      }
    ]
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Also inherits the applicable common errors in section 1: malformed input, invalid session/link, forbidden access, conflicting revision/retry identity, request limits, and service failures. Never return the example error before required access checks.

## 14. Library and provider interfaces

These interfaces are outside the 76 application JSON routes. Their transport belongs to the selected library/provider. The examples below distinguish actual HTTP payloads from SDK arguments; do not send our `data/meta` envelope to these services. Production package versions and signature handling must be pinned and verified during implementation.

### 14.1 Staff login — Auth.js

**Entry point:** Auth.js `signIn("credentials", ...)`, handled under `/api/auth/*`. The conventional Next.js credentials callback is `POST /api/auth/callback/credentials`; let the SDK construct its form body, CSRF exchange, headers, and cookies.

**Access:** Anonymous login attempt; rate-limited. **Input:** required email/password; fixed same-origin redirect target, not an arbitrary user-supplied URL.

**SDK payload example** (arguments, not a raw JSON HTTP body):

```ts
await signIn("credentials", {
  email: "organizer@example.com",
  password: "Example-only-passphrase-2026!",
  redirectTo: "/dashboard"
});
```

**Request headers/body:** managed by Auth.js, including its own CSRF token and session cookie. Do not substitute the application `/security/csrf` token or manually POST the object above as JSON to the callback.

**Success:** library sets the protected session cookie and redirects to the allowed dashboard. Subsequent `GET /api/v1/me` returns the fully documented application profile. There is no `{data:{token}}` login response and no browser-stored bearer token.

**Failure example:** invalid credentials cause the library's credentials failure; render “Email or password is incorrect.” Map account states to safe UI behavior without exposing arbitrary user lookup. Do not assume HTTP 401 or an application JSON error envelope from the library endpoint; redirects and errors follow the pinned Auth.js integration. [Auth.js sign-in/out](https://authjs.dev/getting-started/session-management/login)

### 14.2 Staff logout — Auth.js

**Entry point:** Auth.js `signOut(...)` via its `/api/auth/*` handler; conventional logout transport is `POST /api/auth/signout`.

**SDK payload example:**

```ts
await signOut({ redirectTo: "/login" });
```

**Headers/body:** library-managed session cookie, native CSRF protection, and form payload. No custom JSON request. **Success:** clears the current staff session and redirects to the allowed login page; no application response body. **Failure example:** native CSRF failure leaves the session unchanged; reload and retry using the SDK. Logout does not revoke other staff users, sharing links, or all of this user's sessions. Password reset handles global session invalidation.

### 14.3 Session read — Auth.js

**Entry point:** use `auth()` server-side or the library's client session helper. Client session retrieval is served by the native `GET /api/auth/session` integration. **Request payload:** none. **Headers:** library-managed session cookie; no application CSRF header for this GET.

**Success:** library session object or no session, according to the pinned configuration. This is not the application `data/meta` envelope. Do not expose sessionVersion or full database user records. Use `GET /api/v1/me` for the stable application permission/profile contract.

**Failure example:** network/server failure yields the client helper's error/loading state; do not treat it as permission to load protected data. An expired session causes `/api/v1/me` to return the documented 401. [Auth.js session retrieval](https://authjs.dev/getting-started/session-management/get-session)

### 14.4 Resend delivery callback — POST `/api/webhooks/resend`

**Caller:** Resend only, verified by webhook signature. Browser cookies, `X-CSRF-Token`, and `Idempotency-Key` are not used.

**Headers example:**

```http
POST /api/webhooks/resend HTTP/1.1
Host: wedding.example.invalid
Content-Type: application/json
svix-id: msg_webhook-placeholder
svix-timestamp: 1790238600
svix-signature: v1,signature-placeholder
```

**Example provider payload:**

```json
{
  "type": "email.delivered",
  "created_at": "2026-09-24T08:30:00.000Z",
  "data": {
    "created_at": "2026-09-24T08:29:50.000Z",
    "email_id": "64a2c77e-e2b6-4fce-9064-449478ce19bd",
    "message_id": "<example@mail.example.invalid>",
    "from": "The Couple <invitations@example.invalid>",
    "to": ["aarav@example.com"],
    "subject": "Your wedding invitation"
  }
}
```

Verify the exact received raw bytes and timestamp before parsing or storing. Deduplicate by verified webhook event ID, not email ID: several events can describe the same email. The fixture signature is deliberately nonfunctional. Optional provider fields may be present; verify first, then accept the provider schema and persist only allowed facts. Delivery confirms acceptance by the recipient mail server, not that the guest read the message. [Resend delivered event](https://resend.com/docs/webhooks/emails/delivered), [signature verification](https://resend.com/docs/webhooks/verify-webhooks-requests)

**Success response** after durable receipt, including duplicate receipt:

```http
HTTP/1.1 204 No Content
Cache-Control: no-store
```

No response body. Unknown message IDs are stored for correlation. A signed event type we deliberately do not handle is acknowledged without changing a message's status. Known supported event types with malformed required fields are rejected.

**Error example:** invalid signature, rejected before persistence:

```http
HTTP/1.1 400 Bad Request
Content-Type: text/plain

Invalid webhook
```

Database unavailable after valid verification: `503 Service Unavailable`, so the provider may retry. Never acknowledge durable success before saving the accepted event.

### 14.5 Inngest adapter — GET, POST, PUT `/api/inngest`

**Caller:** Inngest SDK/platform integration. Register the adapter's supported methods, rather than building a general job HTTP API.

| Method | Payload and headers | Success / failure |
| --- | --- | --- |
| GET | SDK-defined inspection request, no application JSON body; production metadata exposure controlled by the pinned adapter | SDK inspection response, not job execution |
| POST | SDK-generated invocation envelope and signature headers; not a browser payload | SDK execution/checkpoint response; signing failure rejected before business code |
| PUT | SDK-defined registration/synchronization request and authentication behavior | SDK synchronization response or SDK error; never a guest-triggered business action |

The wire envelope, signature format, and response status/body are SDK-versioned. Capture and validate them in integration tests after pinning the version; this document deliberately does not invent a callable signed request. Browser cookies and our CSRF header do not authenticate this route. [Inngest HTTP handler](https://www.inngest.com/docs/learn/serving-inngest-functions)

**Application event payload example**, published server-side after the MongoDB outbox commit (not the raw `/api/inngest` request):

```json
{
  "id": "outbox-660000000000000000000014",
  "name": "mmm/assignment.requested",
  "data": {
    "outboxId": "660000000000000000000014",
    "operationId": "660000000000000000000005"
  }
}
```

Proposed event names and permitted payloads:

| Name | Required data fields |
| --- | --- |
| `mmm/assignment.requested` | outboxId, operationId |
| `mmm/email.requested` | outboxId, operationId |
| `mmm/photo.finalize` | outboxId, photoId, generation |
| `mmm/photo.variants` | outboxId, photoId, generation |
| `mmm/photo.delete` | outboxId, photoId, generation |

IDs are ObjectId strings; generation is a positive integer. Handlers load records and verify ownership/state instead of trusting external role, email, or storage-key fields. Coordinator acceptance is not job completion. Business failure becomes the saved operation/photo state and is processed by SDK retries/reconciliation, not disguised as successful completion.

The daily reminder and reconciliation schedules invoke internal functions without a browser-facing endpoint or guest-controlled payload. Database backups remain a separate protected runner, also without an application HTTP endpoint.

### 14.6 Original upload — PUT to the returned R2 URL

**Access:** temporary presigned URL from an authorized upload-initiation/renew response. **Request payload:** binary original image bytes, never JSON or a base64 string.

```http
PUT /staging?signature=placeholder HTTP/1.1
Host: storage.example.invalid
Content-Type: image/jpeg

[binary JPEG bytes]
```

The bracketed line denotes bytes; it is not literal text to send. Use the exact returned URL and signed headers. The browser supplies transfer-related headers. Send no staff cookie, gallery cookie, CSRF token, or application API key to the storage host. Keep the original bytes intact.

**Success example:** R2 `200 OK` with an ETag header and empty body; then call the documented application `/complete` endpoint. Do not interpret an ETag alone as proof of the original's content checksum.

**Failure example:** storage `403` after signature mismatch or expiry. Display an upload error and call `/renew` only while the asset is still pending, then retry the same file. R2 errors use the storage service's response format, not our JSON envelope. A successful storage transfer does not bypass actual file validation. [R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)

### 14.7 Preview/original retrieval — GET to the returned R2 URL

**Access:** unexpired presigned URL returned after application permission checks. **Request body:** none.

```http
GET /original?signature=placeholder HTTP/1.1
Host: storage.example.invalid
Accept: image/jpeg
```

**Success:** `200 OK`, appropriate image Content-Type, binary bytes; original downloads include a safe attachment filename when signed/configured by the backend. Thumbnail/preview retrieval uses the corresponding returned URL. No application JSON wrapper.

**Failure example:** expired URL produces a storage authorization error. Re-fetch the photo list/detail for fresh previews or call the original-download endpoint again, which checks current access. Missing/deleted objects must not cause an automatic re-upload or recreation. Cache lifetimes must not exceed the chosen exposure policy; already downloaded bytes cannot be recalled.

## 15. Documentation coverage and revision

Version 1.1 expands all 76 application route contracts with request headers, payload/query examples, success responses, and error examples. Provider/library interfaces are documented separately to avoid misrepresenting their native protocols. The examples clarify previously implicit field names; they do not implement endpoints or verify production integration behavior.

The documentation checks compare the endpoint index against the full examples, parse JSON blocks, and verify local links and relevant response invariants. Runtime permission, concurrency, provider, and load tests remain required during implementation.

