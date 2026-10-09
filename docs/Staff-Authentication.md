# Staff authentication

Updated: **9 October 2026**. References: [PRD REQ-01](Make-My-Marriage-PRD.md),
[account API guide](Make-My-Marriage-API-Design.md), and
[database reference](Make-My-Marriage-Database-Technical-Reference.md).

## Current account rule

The user explicitly approved public signup: every new account is an active admin
of the single wedding and can sign in immediately. Email verification is deferred.
There is no invitation, email allowlist, role selector, or two-account cap. These
explicit decisions supersede the older specifications. New accounts do not get an
emailVerifiedAt value; their email addresses have not been verified.

Signup requires MongoDB configuration, but no Resend settings. Login additionally
requires NEXTAUTH_SECRET and NEXTAUTH_URL. Set APP_URL and NEXTAUTH_URL to the
browser origin, including its port. Store secrets only in the ignored .env.local.
Public pages and builds still work without external-service credentials.

The first signup reserves the singleton wedding setup identity. Wedding names,
date, time zone, and currency remain unset. Duplicate normalized email addresses
are rejected by application checks and a unique database index.

Stable next-auth 4.24.15 supports the selected Next.js/React versions. Credentials
use JWT sessions and application-owned persistence. Passwords have 15–128 Unicode
code points, without forced symbols or trimming, and use asynchronous salted scrypt.
Sessions expire after 12 hours. Protected operations reload active membership,
current role, and session version; revocation still blocks access immediately.
Client session updates cannot grant permissions.

Signup requires same-origin JSON POST, with an 8 KiB streamed body limit. Auth.js
retains native login/logout CSRF protection. MongoDB counters limit signup/login
to 10/email and 120/application per 15 minutes.

## Storage and checks

Signup initializes the user validator, unique email/singleton indexes, and rate-limit
TTL index. Legacy adminSlot constraints are removed; existing user records are
preserved. Existing pending-verification records are not automatically activated.
No verification routes, tokens, emails, or provider client are used by this flow.

npm run accounts:setup initializes storage only; it creates no users and sends no
emails. npm test covers password policy and a mocked signup/login flow without
email settings. The mock does not demonstrate Atlas write permissions or indexes.

npm run test:integration is opt-in, requires an explicitly selected temporary
database named mmm_account_test_*, refuses nonempty databases, and removes only
that database after testing. Never use application data. The current public-signup
and immediate-login integration test passed against an isolated Atlas database
on 9 October 2026; cleanup was separately confirmed. Details are recorded in
[project progress](Project-Progress.md). This is backend service/callback testing,
not a complete browser authentication journey.

## Deferred work

Email verification and Resend setup will return in a later feature. Previously
approved verification expiry (24 hours) and reset expiry (one hour) remain future
rules, not active behavior. Password recovery, staff management, email delivery
jobs, production rate-limit tuning, deployment checks, and capacity testing remain.
PRD v1.4 and architecture v1.1 were not found; older source documents are retained.
