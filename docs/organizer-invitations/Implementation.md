# Members and wedding ownership

Updated: **15 October 2026**. Source decisions supersede the older singleton PRD,
architecture, database and API proposals. PRD v1.4 / architecture v1.1 still do not
exist locally; older source documents have not been rewritten.

## Implemented behavior

Public signup creates an independent setup wedding with ownerUserId and its admin
user in one transaction. Unique normalized email prevents duplicate accounts and
orphan weddings after concurrent signup. One user has exactly one weddingId.
All existing feature repositories now select by authenticated wedding ID rather
than singletonKey. Legacy primary records and memberships remain intact; no owner
is guessed. Storage initialization removes only the obsolete required singleton
field, retains unrelated validators, and replaces its index with a partial legacy
index. New weddings have a partial unique ownerUserId index.

Members at /members and invitation at /members/invite are admin-only. Admins choose
Co-owner (stored admin) or Organizer; the server derives the recipient's wedding
and assigned role. Current Owner/Co-owner/Admin labels are based on database data.
Co-owners have the same admin permissions, including inviting others. Organizer
revocation increments sessionVersion and keeps records. Owner/admin removal,
transfer, promotion and restoring revoked accounts are deferred.

An invitation reserves a new recipient email using an invited, credential-free
user. Its record, user and actor authorization are coordinated in a transaction.
Public signup cannot turn that invitation into another wedding. Existing account
emails cannot be moved/promoted; pending duplicates require cancelling the earlier
invitation. Expired reservations remain visible and can be cancelled by an admin.
Cancellation removes only its unaccepted placeholder and invalidates its link.

The /accept-invitation capability checks a hashed, HMAC-derived token, normalized
recipient, 48-hour expiry and pending state. Acceptance activates only its matching
placeholder, assigns the stored role and consumes the invitation in a transaction.
The recipient signs in with Auth.js; completed onboarding is reused. Logged-in
visitors are directed to their current workspace. Email verification stays deferred;
acceptance does not write emailVerifiedAt. No public role/wedding selector exists.

## Sending and retries

Server-only src/server/providers/resend.ts calls Resend's documented POST /emails
API with RESEND_API_KEY, STAFF_EMAIL_FROM and APP_URL. No SDK/dependency was added.
[Official send API](https://resend.com/docs/api-reference/emails/send-email).
Config validation is lazy; public signup, public pages and builds need no email key.
Use Make My Marriage <onboarding@resend.dev> only for sending to the Resend account
email; other recipients need a verified owned sender domain.
[Official development restriction](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).
Localhost invitation links work only on the local computer.

Invite requests use client UUIDs, actor/recipient/role binding and a unique
wedding/request index. Concurrent retries reuse the saved invitation. Tokens are
not stored raw or returned by member APIs. Provider retries reuse the same token,
expiry, text and Resend Idempotency-Key. Provider acceptance is shown honestly,
without claiming delivery. Failure preserves the invitation and recipient for
manual retry. Automatic jobs/webhooks/delivery tracking via Inngest are deferred.

Manual sending retries stop 23 hours after creation, within Resend's 24-hour
idempotency window; the acceptance link still expires at 48 hours. Cancel and
create a new invitation after that retry window. Secret changes block reconstruction
for resend rather than substituting a different token. In-flight cancellation can
still leave an email arriving, but its cancelled link cannot grant access.
[Provider idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).

Mutations require same-origin JSON, strict schemas and 8 KiB streamed request caps.
Account acceptance is rate limited (10/email and 120/global per 15 minutes); sends
and retries are limited to 20/admin per 15 minutes. API replies are no-store;
acceptance pages use no-referrer/no indexing. Invitation forms submit by POST and
remain disabled until hydration, preventing native GET submission of credentials. Private reads/writes recheck active
membership; organizers cannot manage staff or settings. Account recovery remains
separate future work, not an invitation password reset.

## Validation status

34 local regressions, lint, formatting, TypeScript and the final Webpack build pass.
Isolated service testing passed legacy validator/index migration, unrelated validator
preservation, concurrent signup rollback, independent ownership/session rules and
rate-limit enforcement on replayed invitation forms without another provider call.
Focused Members HTTP checks passed token binding/replays/expiry, cancellation,
transaction rollback, roles, wedding isolation and stable mock-provider retries.
The full account/onboarding/settings/events HTTP/security suite also passed.

Desktop checks passed validation, role explanations, retained send failure/retry,
keep/confirm cancel/revoke, signed-in invitation handling, password confirmation/
visibility, successful acceptance/token removal, co-owner login without onboarding,
role labels, saved readback and signed-out Back/direct denial. The final limiter-only
adjustment was verified separately by the service regression; UI code was unchanged.
All nine disposable databases were independently confirmed empty and test servers
stopped. See [project progress](../Project-Progress.md) for scope and limitations.
No real email has been sent or tested; no real application records, local service
credentials, dependencies, Git commits/pushes, provisioning or deployment changed.
Mobile/cross-browser checks, a full accessibility audit and capacity testing remain.

Run the HTTP fixture with ACCOUNT_TEST_MEMBERS_ONLY=1 and an unused, explicitly
selected mmm_account_test_* database (maximum 38 bytes). The preload
tests/resend-fixture.mjs is loaded only by that test process, requires loopback and
fictional credentials, and intercepts Resend without contacting the provider.
ACCOUNT_TEST_BROWSER=1 pauses the fixture for desktop checks; use an interactive
terminal and press Enter to clean it up. Existing full account/event suites remain
available separately. Never point these tests at application data.

For a seeded desktop-only fixture, combine ACCOUNT_TEST_MEMBERS_ONLY=1,
ACCOUNT_TEST_BROWSER_ONLY=1 and ACCOUNT_TEST_BROWSER=1. ACCOUNT_TEST_PORT=3108
can keep it separate from the main 3107 suite; auxiliary checks use 3109–3111.
The browser-only mode seeds onboarding but does not claim automated Members checks.
