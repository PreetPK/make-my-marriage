# Make My Marriage — project progress

Last updated: **12 October 2026**.
Latest application validation: **12 October 2026** — complete wedding onboarding and
17 local regressions, live HTTP/security checks and a browser journey.

This is the project-wide record of completed work and remaining features. The
specifications describe requirements; this file records what actually exists.
Read [README](../README.md) for setup and
[the homepage design reference](Homepage-Design.md) for visual sources and assets.

## Current position

The scaffold and approved Stitch homepage UI are implemented. The homepage uses
sample wedding content; wedding management and guest features are not yet working.
Public signup creates active admins of the single wedding, with immediate login,
sign-out, server-protected dashboard entry, and authenticated account-page
redirects. Email verification is deferred. Browser Back/Forward restores now
recheck access; logged-out visitors cannot reopen dashboard content.

MongoDB Atlas connectivity, isolated account persistence, HTTP security checks,
and real browser authentication journeys have passed. Seventeen local regressions
and the development checks passed on 12 October; security coverage is recorded in
[authentication test coverage](Authentication-Test-Coverage.md) for scenarios and
limits. Public pages and builds remain available without service credentials;
working signup/login require MongoDB and authentication configuration.

The complete three-step onboarding flow saves couple details, explicit time zone/
currency, and optional venue to the shared wedding in MongoDB. Admins resume saved
progress, finish setup once, and then reach a dashboard showing saved details.
Stale revisions cannot overwrite another admin’s changes. The homepage still uses
sample content; website editing, guest access, and other integrations remain future
work. See [onboarding implementation](wedding-onboarding/Implementation.md).
Production readiness and the 1,000-guest / 1,000-event target are unvalidated.
The latest authentication fixes and complete onboarding are still local, uncommitted,
and unpushed.

Statuses used below:

- **Complete:** the stated scope is implemented and checked.
- **UI only:** presentation exists; the underlying feature is not implemented.
- **Partial:** some work exists; the remaining scope is identified.
- **Not started:** no implementation exists.

## Foundation and design

| Area                            | Status   | Completed scope / remaining work                                                                                                                                                                                                                                                                                               |
| ------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Repository and scaffold         | Complete | One Next.js application and npm manifest; TypeScript, Zod, Tailwind, exact dependencies and lockfile, Node/npm pins, standard configuration, README, and root AGENTS instructions.                                                                                                                                             |
| Application shell               | Complete | Minimal root layout, metadata requesting no indexing, global styles, custom 404, and server-only validation for basic environment settings.                                                                                                                                                                                    |
| Development checks              | Complete | Lint, formatting, type-check, and build scripts exist. Webpack build passes; the local Turbopack port restriction remains documented in README. Seventeen local regressions pass, including onboarding calendar/name validation. Prior isolated Atlas lifecycle, HTTP security and browser authentication checks are recorded. |
| Architecture and specifications | Partial  | Six source documents exist and approved working conventions are recorded. Missing versions, contradictory permissions, and proposed defaults still need resolution with their features; see the open items below.                                                                                                              |
| Stitch design access            | Complete | Connection authenticated and the Make My Marriage Website project retrieved. This is development tooling, not an app dependency; its key is outside the repository.                                                                                                                                                            |
| Homepage design and assets      | Complete | User-approved desktop design translated into responsive UI; local fonts with licenses, logo, portrait, map artwork, shared colors, and typography.                                                                                                                                                                             |
| Other Stitch screens            | Partial  | Stitch sign-in layout implemented; public admin signup uses the same visual language. Onboarding desktop/mobile direction accepted; all three steps and saving/error states implemented. Full management dashboards remain future work. Admin/organizer dashboards and empty-dashboard screens remain unimplemented.           |

## Homepage coverage

Implementation: [page composition](../src/app/page.tsx) and
[feature components](../src/features/wedding/components/).

| Section               | UI status | Working behavior / boundary                                                                                                                          |
| --------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header and navigation | Complete  | Desktop links, mobile menu, skip link, sticky-header spacing, and link to staff sign-in.                                                             |
| Hero                  | Complete  | Sample couple names, date, venue, arched portrait, and working link to celebrations.                                                                 |
| Couple's story        | Complete  | Approved sample copy, two-column desktop layout, and stacked mobile layout.                                                                          |
| Celebrations          | Complete  | Three sample event cards, event-detail dialogs, and links to the venue section. These are not published database events.                             |
| Invitation access     | UI only   | Layout and email-invitation guidance; invitation action is disabled. No guest lookup, invitation token validation, or RSVP exists.                   |
| Gallery and sharing   | UI only   | Feature overview, sample album count, and working QR disclosure. QR illustrations are labeled not scannable; album viewing and uploads are disabled. |
| Livestream            | UI only   | Clearly labeled player preview; no configured YouTube stream or playback.                                                                            |
| Venue                 | Complete  | Sample venue information, map preview preserving attribution, and external Google Maps search link.                                                  |
| Footer                | Complete  | Closing copy, copyright, and working section links.                                                                                                  |

“Complete” here refers to the UI scope only. Real wedding settings and access rules
are still required before this becomes the guest-facing wedding website.

## Full application features

Requirement references link to the [PRD](Make-My-Marriage-PRD.md); implementation
must also follow the [architecture](Make-My-Marriage-System-Architecture.md),
[database design](Make-My-Marriage-Database-Design.md), and
[API design](Make-My-Marriage-API-Design.md).

| Feature                          | Requirement                  | Status      | Remaining scope                                                                                                                                                                              |
| -------------------------------- | ---------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Staff accounts and authorization | REQ-01 (scope updated 9 Oct) | Partial     | Public admin signup, sign-in/out, server-protected entry, signed-in account redirects, and Back/Forward checks pass. Verification/Resend, recovery/reset, and production preparation remain. |
| Shared and personal guest access | REQ-02                       | Not started | Server-validated wedding, invitation, and gallery links, revocation/replacement, and scoped access.                                                                                          |
| Wedding setup and website        | REQ-03                       | Partial     | Shared three-step onboarding, persistence, saved-step resume and completion routing work. Completed-wedding editing, story/photos, homepage connection and guest website access remain.      |
| Event management                 | REQ-04                       | UI only     | Staff event CRUD, guest assignments, admin-only general publication, and agreed cancellation behavior. Homepage cards are sample UI only.                                                    |
| Guests and digital invitations   | REQ-05                       | Not started | Individual guest records, event assignments, personal links, controlled invitation sends, and delivery results.                                                                              |
| Event-level RSVP                 | REQ-06                       | Not started | Authorized responses, statuses, staff corrections, and confirmed deadline behavior.                                                                                                          |
| Email reminders                  | REQ-07                       | Not started | Manual and scheduled reminders, eligibility, retries, and truthful delivery history.                                                                                                         |
| Staff dashboards                 | REQ-08                       | Partial     | Protected welcome, saved wedding summary and sign-out exist. Full management dashboard UI, counts, filters and feature data remain.                                                          |
| Expenses                         | REQ-09                       | Not started | Expense records, categories, payment state, and approved totals/model.                                                                                                                       |
| Organizer management             | REQ-10 (original scope)      | Not started | Invitation-only organizer roles are superseded for new signups; all new accounts are admins. Future staff-management scope needs discussion with that feature.                               |
| Planner discovery                | REQ-11                       | Not started | Sample planner directory; real planner API integration remains outside initial scope.                                                                                                        |
| Photo galleries and QR sharing   | REQ-12                       | UI only     | Authorized albums, R2 uploads, image processing, original downloads, real link-based QR codes, and admin-only deletion.                                                                      |
| YouTube livestream               | REQ-13                       | UI only     | Admin configuration and guest playback under the confirmed access rules.                                                                                                                     |

## Infrastructure and release work

| Area                         | Status      | Remaining scope                                                                                                                                                                                                                                                                                          |
| ---------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MongoDB Atlas                | Partial     | Official driver 7.7.0, lazy reusable server-only connection, and read-only ping command added. Live Atlas connection and read-only ping passed. Account and onboarding repositories, validators and indexes are implemented; isolated persistence/concurrency tests pass. Other feature storage remains. |
| Resend                       | Not started | Deferred with email verification; no current provider client or dependency. Domain, sender, delivery, and durable jobs remain.                                                                                                                                                                           |
| Cloudflare R2                | Not started | Private storage, authorized transfers, image processing, and retention/deletion workflows.                                                                                                                                                                                                               |
| Inngest                      | Not started | Job entry points, background processing, scheduled reminders, and retries.                                                                                                                                                                                                                               |
| Feature and security testing | Partial     | Seventeen local regressions and onboarding UI/access checks pass. Prior isolated Atlas lifecycle/HTTP security and browser auth/history checks are recorded. Other feature tests, production abuse controls, delivery, and capacity remain.                                                              |
| Operations and deployment    | Not started | Environment separation, backups, observability, provider capacity checks, Vercel deployment, and release acceptance checks.                                                                                                                                                                              |

## Verification recorded so far

These are results from the completed scaffold/homepage work, not new checks run
when this tracker was created:

- Lint, formatting, type checking, and `npm run build -- --webpack` passed.
  Do not report the default Turbopack build as passing in this environment.
- Local HTTP checks covered the homepage, styles, images, and custom 404.
- Homepage browser checks covered desktop, tablet, and mobile layouts, including
  no horizontal overflow at 320px and 390px; image/font loading; section links;
  mobile-menu closure; dialog Escape dismissal and focus return; QR disclosure;
  and no uncaught browser errors during those checks.
- An earlier read-only review found no actionable issues in the scaffold and
  initial homepage work. It preceded the full-homepage completion; it is not a
  review of every current or future change.

### Account UI checks — 8 October 2026

- Lint, formatting, type checking, and the Webpack production build passed.
- Browser checks covered required fields, invalid email, first-error focus,
  password visibility, confirmation mismatch, truthful unavailable responses,
  cleared input after a valid preview submission, and no role selector.
- Both routes fit 320px and 390px viewports without horizontal overflow.
- Controls remain disabled without JavaScript. No credential POST requests or
  uncaught browser errors occurred during the interactive checks.
- These checks verify the UI preview only, not authentication or invitation security.

## Open items and decisions

- This checkout has PRD v1.3 and architecture v1.0. Later documents reference
  PRD v1.4 and architecture v1.1, which were not found locally. Check for newer
  copies before revising the older specifications.
- The confirmed target is 1,000 unique guests and 1,000 events, superseding the
  older 10-by-10 baseline. This is a planning target, not a tested capacity claim.
- General event publication is admin-only under the PRD; the proposed API's
  organizer permission conflicts with that rule and must be resolved.
- Auth.js stable 4.24.15 release and credentials/JWT compatibility were verified
  and selected. MongoDB driver 7.7.0 is installed; live connectivity and account
  persistence are verified. Wedding/guest persistence remains future work.
- Product and service defaults still marked proposed remain open. Resolve them
  when implementing the relevant feature; see README and the source documents.
- Real wedding copy, dates, images, and venue details are still needed. Sample
  content and disabled actions do not count as completed product behavior.

## Next feature boundary

Core onboarding is complete. The next feature should cover completed-wedding
settings and website content, including safe editing rules and the guest website
access/publication boundary, before replacing homepage sample content. Its exact
scope still needs discussion; see [onboarding implementation](wedding-onboarding/Implementation.md).

## Milestone history

| Milestone                                | Reference                         | Result                                                                                         |
| ---------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------- |
| Initial scaffold                         | `c25f2a9`                         | Minimal app, tooling, environment validation, and six source documents committed.              |
| Approved homepage UI                     | `ca548a2`                         | Full responsive homepage, assets, design reference, and root AGENTS instructions committed.    |
| Progress tracking added — 6 October 2026 | This document                     | Project-wide status recorded; future update convention added to AGENTS.md.                     |
| Staff account UI — 8 October 2026        | [Account UI scope](Account-UI.md) | Sign-in and invitation-only signup screens added as previews; backend authentication deferred. |

## MongoDB foundation verification — 8 October 2026

- npm confirmed stable driver 7.7.0 requires Node >=20.19.0; installed with an
  exact pin for the project's Node 24 runtime.
- Lint, formatting, TypeScript, and credential-free Webpack production build
  passed. Homepage and account routes still prerender without MongoDB settings.
- A temporary Node assertion script with a mocked driver passed missing-config,
  sanitized connection error, failed-connection retry, concurrent pool reuse,
  explicit database selection, and cleanup checks. These are not Atlas tests.
- After local configuration, `npm run db:check` exited successfully against the
  existing Atlas development cluster. Connection and read-only ping passed; no
  application records were changed. Collection write permissions and UI read/write
  behavior remain unverified.
- npm audit reports five high-severity entries in the existing ESLint tooling
  dependency chain (`braces` through `eslint-config-next`), none in the MongoDB
  driver. Its suggested major downgrade was not applied; tooling remediation
  remains pending.

## Staff account backend — 8 October 2026

See [implementation and setup](Staff-Authentication.md). The user approved account
rules and controlled two-admin setup. Stable NextAuth 4.24.15, Resend 6.32.1, and
tsx 4.23.15 were verified and pinned. Policy tests and isolated Atlas lifecycle
tests passed, covering concurrent invitation redemption, single-use verification,
replacement challenges, login eligibility, absolute session lifetime, client-claim
rejection, and revocation. Temporary databases were removed. Email HTTP calls
were intercepted in passing tests; an initial failed mock attempt was rejected
by Resend with a dummy key, and no message was sent. No real partner records or
invitations were created. Delivery awaits Resend configuration. Recovery/reset
and organizer management remain unimplemented.

Final account checks: lint, formatting, TypeScript (including setup/test scripts),
policy tests, and Webpack production builds passed, including a build with MongoDB,
auth secret, and Resend key explicitly absent. Browser checks verified required
field focus, rejected uninvited sign-in, disabled signup without email setup, and
anonymous workspace redirect. Final production HTTP checks passed native Auth.js
CSRF/credentials failure, no unauthorized session, origin rejection, invalid
verification, unconfigured email refusal, and the streamed request-size cap.
The admin setup command was not executed: automatic
approval review rejected a combined validation/setup command because setup can
write accounts and send invitations. Resend/partner setup is still pending.

## Public admin signup — 9 October 2026

User-approved scope change: every public signup gets admin access to the same
wedding after email verification. Removed invitation-token/preauthorized-email
requirements and the two-admin cap. Signup fields are editable without Resend;
submission reports missing verification email configuration honestly. Replaced
partner bootstrap with account storage initialization, including legacy validator
and adminSlot-index migration. Wedding settings remain unset until setup.

Local password/policy tests, lint, and TypeScript passed. The live public-signup
test has been updated but is pending explicit approval: automatic approval review
blocked creating/deleting the named temporary Atlas database. Earlier invitation
tests do not validate this new flow. No real accounts or emails were created.
Webpack production build and formatting passed. Browser checks confirmed the
public signup fields accept input without an invitation, validation focuses the
password field, and the missing-email-setup notice is visible.

## Email verification deferred — 9 October 2026

The user deferred verification. Signup now creates active admins and permits
immediate password sign-in without Resend. Removed verification/resend UI, routes,
token creation, provider client, and Resend dependency. Unverified email addresses
are not marked verified. Revocation, session checks, hashing, and request limits remain.
Existing pending accounts are preserved rather than silently activated.

Validation passed: four local tests (including mocked signup/immediate login,
three admins, duplicate email, and revocation), lint, formatting, TypeScript,
and the Webpack production build. Browser inspection confirmed editable signup
fields and no verification or email-setup controls. Removed routes are absent
from the generated production route table. Live Atlas
signup testing remains unrun: automatic approval review rejected the temporary
remote database create/delete lifecycle; explicit approval is still pending.
No real accounts or emails were created for this change.

## Latest validation run — 9 October 2026

Reran all four local account tests, lint, formatting, TypeScript, and the Webpack
production build; all passed. A read-only Atlas connection/ping also passed.
Browser checks passed for signup and login required-field validation, password
mismatch/focus, password visibility controls, anonymous dashboard redirect to
login, and the removed verification page returning the not-found screen.
No real accounts, email messages, or application database writes were made.
Signup/login persistence is covered locally with a mocked driver; live Atlas
signup lifecycle testing remains pending the explicit temporary-database approval.

## Live Atlas account validation — 9 October 2026

After explicit user approval, npm run test:integration passed against the new
isolated database mmm_account_test_20261009_public01. The test verified concurrent
duplicate signup creates one account, normalized email uniqueness, removal of
legacy adminSlot constraints, three active admins in the same wedding, immediate
password login without email verification, incorrect-password rejection, absolute
12-hour session expiry, rejection of client-supplied access claims, and revocation.
The temporary database was deleted in test cleanup. A separate read-only check
confirmed no collections remained. Application data was untouched; no real accounts
or email messages were created. Earlier pending-approval notes above are historical;
the current live account test is now validated. This tests backend services and
Auth.js callbacks against Atlas, not a full browser signup/login/logout journey.

## Signed-in account page redirects — 9 October 2026

Fixed the missed scenario where a signed-in visitor could still open /login or
/signup. Both pages now check the validated session on the server and redirect
active staff to /dashboard; anonymous and invalidated sessions retain access to
the forms. Credential-free rendering remains available. Added a regression test
that executes both page functions using controlled Auth.js session results and
checks the actual Next.js redirect, anonymous/invalidated behavior, and missing
configuration. This does not replace a full browser login/logout journey.

All five local tests, lint, formatting, TypeScript, and the Webpack build passed.
Stale generated development route types referencing the removed verification
page were cleared before regenerating the successful build. No database writes
were needed. Changes have not been committed or pushed.

## Authentication security and browser checks — 9 October 2026

Completed the real browser signup/login/refresh/logout journey with fictional
accounts, including signed-in login/signup redirects, a second tab, revoked
sessions, and rejected re-login. Added an opt-in production-server HTTP suite
covering CSRF, cookies, session invalidation, client claims, injection attempts,
request sizes, rate limits, redirects, database outages, and missing configuration.
See [authentication test coverage](Authentication-Test-Coverage.md) for exact
scenarios and limits; this is not a claim of complete production security.

Fixed signup throttling returning 400 instead of 429, bounded Auth.js mutation
bodies at 8 KiB, required their configured origin/content type, and made malformed
JSON return 400. Stream errors are sanitized. Added no-store API responses and
basic MIME/frame/referrer headers. Existing Auth.js CSRF protection remains.

Seven local regressions, lint, formatting, TypeScript, and Webpack builds passed.
The final HTTP/security suite passed; HTTPS cookie flags were checked through
configuration, without a deployed TLS environment. Three isolated databases
were deleted; a separate read-only cleanup check is recorded with the final run.
No application data, local credentials, or real email delivery were changed.
Production npm audit is clean; the full audit retains five development-tooling
findings from unpatched braces. No incompatible downgrade or unverified patch
was installed. Changes remain uncommitted and unpushed.

## Authentication browser history — 9 October 2026

Fixed the missed Back/Forward scenario. Login and logout now replace their current
history entry with a fresh document. Account and staff layouts hide their content
before history snapshots and reload restored entries through server authorization.
Back remains usable for public navigation. Failed logout reports an error.

The in-app Chromium browser passed signup/login → Back/Forward, direct signed-in
login/signup redirects, and logout → Back/Forward through older dashboard entries.
Anonymous direct dashboard access also returned to login. Ten local regressions,
lint, formatting, TypeScript, and the Webpack production build passed. The full
HTTP suite passed during investigation; the final build used a browser-only
fixture. Two isolated history databases were deleted and their cleanup separately
confirmed. No application data or credentials were changed. See
[authentication test coverage](Authentication-Test-Coverage.md) for limits.
Changes remain uncommitted and unpushed.

## Wedding onboarding design draft — 12 October 2026

Created the first onboarding desktop screen in the existing Stitch project,
matching the approved homepage/account palette and fonts. Refined the draft
into an open two-column welcome/form composition. It contains required couple
names, an optional date with an undecided option, a three-step indicator, and
shared-wedding guidance. Saved the [design brief and preview](wedding-onboarding/DESIGN.md).

This is a proposed visual design awaiting user review, not a working feature.
Settings/venue steps, mobile layouts, and validation states remain. Screenshots
were visually inspected; documentation formatting and links checked. No application
code, authentication behavior, dependencies, database data or deployment changed.

## Wedding onboarding settings and venue drafts — 12 October 2026

The user approved the Couple details design. Created matching desktop drafts for
Wedding settings (required, initially unselected time zone/currency) and Venue
(optional name/address and undecided option). The final action is Finish setup;
the design explicitly separates setup completion from guest website publication.
Saved the screen references and previews in the
[onboarding design brief](wedding-onboarding/DESIGN.md).

Steps 2–3 await visual review; mobile and validation/loading states remain.
Visually inspected both exported screenshots and checked documentation formatting
and links. Application implementation, onboarding redirects, persistence and
functional tests have not started. No application code, dependencies, database
data or deployment changed.

## Wedding onboarding mobile and state drafts — 12 October 2026

The user approved the settings/venue desktop screens. Generated matching mobile
drafts for all three steps and four interaction references: couple-detail errors
(including an invalid provided date), missing time zone/currency, saving, and
save failure with preserved entries and retry. Standardized headers, progress,
and footers; removed invented policy/support links and corrected a duplicate header.
Saved all seven previews and screen references in the
[onboarding design brief](wedding-onboarding/DESIGN.md).

Mobile and interaction-state designs await user review. Visually inspected the
screenshots and checked documentation formatting/local links. No browser
responsive, keyboard, contrast, validation, or persistence tests were performed.
Application implementation remains unstarted; no application code, dependencies,
authentication behavior, database records, or deployment changed.

## Wedding onboarding Step 1 UI — 12 October 2026

Implemented an admin-only /onboarding preview matching the approved design, with
its own minimal setup shell and a dashboard entry link. Required couple names,
optional calendar date, undecided-date toggle, inline errors, and first-error
focus work. Continue validates only and explicitly reports that details are not
saved; no onboarding completion or automatic setup redirects were added.

Seventeen local regressions, lint, formatting, TypeScript and the Webpack production
build passed. In-app Chromium checks covered date/name validation, retained input,
editing/focus, keyboard order, desktop and 320px/390px layouts, and anonymous/
organizer denial. Onboarding logout plus Back/Forward/direct requests denied access.
Confirmed the fictional wedding details were not saved. The disposable browser
fixture was removed and cleanup independently verified. No application data,
local secrets, email delivery, or dependencies changed.

See [implementation status](wedding-onboarding/Implementation.md) for exact checks
and limits. Wedding settings/venue UI, persistence, resume, concurrent edits and
setup completion remain next parts. Latest changes are uncommitted and unpushed.

## Complete wedding onboarding — 12 October 2026

Completed the approved three-step UI and backend: explicit time zone/currency,
optional venue, per-step MongoDB saves, refresh resume, draft retention on Back,
loading/error/retry states, and shared setup completion. Server-derived membership,
admin authorization, strict bounded JSON and atomic revision checks prevent
unauthorized or stale overwrites. The singleton is configured once; later admins
skip setup and see the same saved details. Completion activates the workspace,
records its completion time, and does not publish the guest website.

All 17 local tests, lint, formatting, TypeScript and the Webpack build passed. The
full authentication/security HTTP suite passed with live onboarding validation,
organizer denial, concurrent saves/completion, minor-unit metadata, optional
fields, resume, replay and database-validator checks. Browser tests covered the
whole journey, stale-tab recovery, mobile layouts, saved-state refresh, completion
history/redirects and a later admin. A controlled fixture-only storage rejection
proved final-save failure retained inputs and made no partial write; retry then
completed exactly once. Both disposable databases were removed and cleanup
independently confirmed. Application data, secrets, dependencies and email delivery
were unchanged. An initial long fixture name was rejected before any writes and
replaced with a validated shorter name.

See [implementation and test details](wedding-onboarding/Implementation.md).
Added a final client-selection regression: server-supplied options remain valid
without relying on browser ICU data; authoritative validation remains server-side.
The final build, lint, type checks and all 17 local tests passed after that change.
Completed-wedding editing, homepage connection, guest access/publication and other
wedding-management features remain. Changes are uncommitted and unpushed.

## Keeping this record current

Update affected status rows and the last-updated date with each meaningful change.
Add a concise milestone for completed features or substantial scope changes.
Record what was implemented, remaining limitations, and checks actually run.
Reference specifications and Git commits where useful instead of copying their
contents. Do not use unsupported completion percentages or mark planned work,
sample data, disabled controls, or unverified behavior as complete. Read-only
reviews do not require changing this file.
