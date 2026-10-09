# Make My Marriage — project progress

Last updated: **9 October 2026**.

This is the project-wide record of completed work and remaining features. The
specifications describe requirements; this file records what actually exists.
Read [README](../README.md) for setup and
[the homepage design reference](Homepage-Design.md) for visual sources and assets.

## Current position

The scaffold is complete, and the full homepage UI is implemented using the
approved Stitch design. The app runs locally without external-service credentials.
Staff sign-in, public admin signup, sign-out, and a protected
workspace entry now have backend implementations. Real account setup awaits
MongoDB and authentication configuration; email verification is deferred.
It is a UI preview with sample wedding content, not a working wedding-management
system. A server-only MongoDB connection layer and read-only check are available; live
Atlas connection and read-only ping passed on 8 October 2026. Wedding/guest UI persistence,
guest access, and other provider integrations have not been implemented. Production readiness and the 1,000-guest / 1,000-event
planning target have not been validated.

Statuses used below:

- **Complete:** the stated scope is implemented and checked.
- **UI only:** presentation exists; the underlying feature is not implemented.
- **Partial:** some work exists; the remaining scope is identified.
- **Not started:** no implementation exists.

## Foundation and design

| Area                            | Status   | Completed scope / remaining work                                                                                                                                                                                  |
| ------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository and scaffold         | Complete | One Next.js application and npm manifest; TypeScript, Zod, Tailwind, exact dependencies and lockfile, Node/npm pins, standard configuration, README, and root AGENTS instructions.                                |
| Application shell               | Complete | Minimal root layout, metadata requesting no indexing, global styles, custom 404, and server-only validation for basic environment settings.                                                                       |
| Development checks              | Complete | Lint, formatting, type-check, and build scripts exist. Webpack build passes; the local Turbopack port restriction remains documented in README. Account policy and isolated Atlas lifecycle tests now exist.      |
| Architecture and specifications | Partial  | Six source documents exist and approved working conventions are recorded. Missing versions, contradictory permissions, and proposed defaults still need resolution with their features; see the open items below. |
| Stitch design access            | Complete | Connection authenticated and the Make My Marriage Website project retrieved. This is development tooling, not an app dependency; its key is outside the repository.                                               |
| Homepage design and assets      | Complete | User-approved desktop design translated into responsive UI; local fonts with licenses, logo, portrait, map artwork, shared colors, and typography.                                                                |
| Other Stitch screens            | Partial  | Stitch sign-in layout implemented; invited signup uses the same visual language. Admin/organizer dashboards and empty-dashboard screens remain unimplemented.                                                     |

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

| Feature                          | Requirement                  | Status      | Remaining scope                                                                                                                                                                           |
| -------------------------------- | ---------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Staff accounts and authorization | REQ-01 (scope updated 9 Oct) | Partial     | Public signup immediately creates active admins; sign-in/out, protected entry, and storage initialization exist. Email verification/Resend, recovery/reset, and production checks remain. |
| Shared and personal guest access | REQ-02                       | Not started | Server-validated wedding, invitation, and gallery links, revocation/replacement, and scoped access.                                                                                       |
| Wedding setup and website        | REQ-03                       | UI only     | Admin-managed wedding settings, real content, persistence, and guest website access.                                                                                                      |
| Event management                 | REQ-04                       | UI only     | Staff event CRUD, guest assignments, admin-only general publication, and agreed cancellation behavior. Homepage cards are sample UI only.                                                 |
| Guests and digital invitations   | REQ-05                       | Not started | Individual guest records, event assignments, personal links, controlled invitation sends, and delivery results.                                                                           |
| Event-level RSVP                 | REQ-06                       | Not started | Authorized responses, statuses, staff corrections, and confirmed deadline behavior.                                                                                                       |
| Email reminders                  | REQ-07                       | Not started | Manual and scheduled reminders, eligibility, retries, and truthful delivery history.                                                                                                      |
| Staff dashboards                 | REQ-08                       | Not started | Admin/organizer layouts, counts, filters, and authorized data.                                                                                                                            |
| Expenses                         | REQ-09                       | Not started | Expense records, categories, payment state, and approved totals/model.                                                                                                                    |
| Organizer management             | REQ-10 (original scope)      | Not started | Invitation-only organizer roles are superseded for new signups; all new accounts are admins. Future staff-management scope needs discussion with that feature.                            |
| Planner discovery                | REQ-11                       | Not started | Sample planner directory; real planner API integration remains outside initial scope.                                                                                                     |
| Photo galleries and QR sharing   | REQ-12                       | UI only     | Authorized albums, R2 uploads, image processing, original downloads, real link-based QR codes, and admin-only deletion.                                                                   |
| YouTube livestream               | REQ-13                       | UI only     | Admin configuration and guest playback under the confirmed access rules.                                                                                                                  |

## Infrastructure and release work

| Area                         | Status      | Remaining scope                                                                                                                                                                                                        |
| ---------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MongoDB Atlas                | Partial     | Official driver 7.7.0, lazy reusable server-only connection, and read-only ping command added. Live Atlas connection and read-only ping passed. Feature repositories, indexes, migrations, and data validation remain. |
| Resend                       | Not started | Deferred with email verification; no current provider client or dependency. Domain, sender, delivery, and durable jobs remain.                                                                                         |
| Cloudflare R2                | Not started | Private storage, authorized transfers, image processing, and retention/deletion workflows.                                                                                                                             |
| Inngest                      | Not started | Job entry points, background processing, scheduled reminders, and retries.                                                                                                                                             |
| Feature and security testing | Partial     | Account policy tests and isolated live Atlas lifecycle tests pass. Other feature tests, production abuse controls, delivery, and capacity testing remain.                                                              |
| Operations and deployment    | Not started | Environment separation, backups, observability, provider capacity checks, Vercel deployment, and release acceptance checks.                                                                                            |

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
  and selected. MongoDB driver 7.7.0 is now installed; live connectivity has passed, while UI persistence
  still needs implementation and verification.
- Product and service defaults still marked proposed remain open. Resolve them
  when implementing the relevant feature; see README and the source documents.
- Real wedding copy, dates, images, and venue details are still needed. Sample
  content and disabled actions do not count as completed product behavior.

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

## Keeping this record current

Update affected status rows and the last-updated date with each meaningful change.
Add a concise milestone for completed features or substantial scope changes.
Record what was implemented, remaining limitations, and checks actually run.
Reference specifications and Git commits where useful instead of copying their
contents. Do not use unsupported completion percentages or mark planned work,
sample data, disabled controls, or unverified behavior as complete. Read-only
reviews do not require changing this file.
