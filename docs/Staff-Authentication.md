# Staff authentication

Updated: **15 October 2026**. References: [PRD REQ-01](Make-My-Marriage-PRD.md),
[account API guide](Make-My-Marriage-API-Design.md), and
[database reference](Make-My-Marriage-Database-Technical-Reference.md).

## Current account rule

Public signup creates a new wedding and its admin owner together in a MongoDB
transaction. The website supports independent weddings, with one wedding per
account. The wedding stores ownerUserId; a co-owner is an invited admin of the same
wedding. Organizers have the existing limited permissions. An invitation reserves
the recipient email for its intended wedding; signup cannot bypass that reservation.
Existing accounts cannot move weddings or be promoted through an invitation.

This user-approved policy supersedes both singleton public-admin signup and the
intermediate invite-only-everywhere proposal. Existing admins keep their old
membership. Legacy weddings without ownerUserId show Admin rather than an invented
Owner/Co-owner distinction. No verification requirement or emailVerifiedAt is added.

Signup requires MongoDB but no email configuration. Login requires NEXTAUTH_SECRET
and NEXTAUTH_URL. Staff invitation sending additionally requires RESEND_API_KEY,
STAFF_EMAIL_FROM and a reachable APP_URL. Store secrets only in ignored .env.local.
Public rendering/builds remain independent of credentials. See
[Members implementation](organizer-invitations/Implementation.md).

Stable next-auth 4.24.15 supports the selected Next.js/React versions. Credentials
use JWT sessions and application-owned persistence. Passwords have 15–128 Unicode
code points, without forced symbols or trimming, and use asynchronous salted scrypt.
Sessions expire after 12 hours. Protected operations reload active membership,
current role, and session version; revocation still blocks access immediately.
Client session updates cannot grant permissions. Signed-in visitors to /login or
/signup are redirected to /dashboard after server-side session validation;
anonymous or invalidated sessions can still access the forms. Admins with incomplete
shared wedding setup are then routed from the dashboard to onboarding; completed
setup is reused by every admin. See [onboarding implementation](wedding-onboarding/Implementation.md). Login and logout
replace the current history entry using a fresh document. Auth/staff layouts hide
cached snapshots and reload Back/Forward restores through the server session
checks. Public homepage navigation remains available. Logout failures show an
error instead of presenting a successful sign-out.

Signup requires same-origin JSON POST. Authentication mutations also require the
configured origin and JSON or form-encoded bodies. Both streams are capped at
8 KiB, and malformed requests are rejected before account operations. Auth.js
retains native login/logout CSRF protection. MongoDB counters limit signup/login
to 10/email and 120/application per 15 minutes; signup throttling returns 429 with
a Retry-After hint. API responses are not cached. Basic frame, MIME, and referrer
headers are configured in next.config.ts.

## Storage and checks

Signup initializes user/wedding validation, unique email/owner indexes, a partial
legacy singleton index, and the rate-limit TTL index. Singleton requirements are
removed from old wedding validators while unrelated validation is preserved. Legacy adminSlot constraints are removed; existing user records are
preserved. Existing pending-verification records are not automatically activated.
Public signup sends no email. Staff invitation tokens/provider client are a separate feature.

npm run accounts:setup initializes storage only; it creates no users and sends no
emails. npm test covers password policy, a mocked signup/login flow without email settings,
and both auth pages with controlled valid, anonymous, invalidated, and unconfigured
sessions. Page tests execute the page functions and real Next.js redirects while
mocking the validated Auth.js session; they do not exercise browser cookies.

npm run test:integration is opt-in, requires an explicitly selected temporary
database named mmm_account_test_*, refuses nonempty databases, and removes only
that database after testing. Never use application data. The current public-signup
and immediate-login integration test passed against an isolated Atlas database
on 9 October 2026; cleanup was separately confirmed. Details are recorded in
[project progress](Project-Progress.md). This is backend service/callback testing,
not a complete browser authentication journey.

The production-server HTTP/security suite and a real browser account journey
also passed against isolated Atlas test data. See
[authentication test coverage](Authentication-Test-Coverage.md) for scenarios,
commands, cleanup, known tooling findings, and release limitations.

## Deferred work

Email verification remains deferred. Real invitation delivery and a verified sender
domain require separate validation. Previously
approved verification expiry (24 hours) and reset expiry (one hour) remain future
rules, not active behavior. Password recovery, owner transfer/admin removal, automatic email delivery
jobs, production rate-limit tuning, deployment checks, and capacity testing remain.
PRD v1.4 and architecture v1.1 were not found; older source documents are retained.

## Protected-read optimization — 13 October 2026

Protected pages/API requests validate the native encrypted Auth.js session cookie
and shared absolute-lifetime policy, then read current active DB membership.
Server Component callers share that lookup and the wedding read only within one
render. Route handlers, mutations and later requests recheck current access.
No persistent permissions cache or bearer login is introduced. Native Auth.js
session/login/logout endpoints retain their normal callbacks. See
[performance](Performance.md) for verification and measured results.
