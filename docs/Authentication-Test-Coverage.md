# Authentication test coverage

Last updated: **12 October 2026**. Current behavior is documented in
[staff authentication](Staff-Authentication.md); milestones are in
[project progress](Project-Progress.md). This covers the current account feature,
not a complete security audit or future wedding-management permissions.

## Checks completed

| Area                   | Coverage and result                                                                                                                                                                                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local regression tests | Ten account-specific regressions pass; the combined suite now has 17 tests with onboarding validation. Account coverage includes hashing/policy, login/revocation, redirects, history, malformed inputs, body limits and sanitized failures.                                          |
| Real browser journey   | Passed signup → login → dashboard → refresh → logout. Signed-in visits to both account pages returned to the dashboard. A second tab shared login and lost access after logout/reload. Database revocation denied both tabs and a fresh login attempt.                                |
| HTTP authentication    | Passed real Auth.js CSRF/cookie login/logout, wrong passwords, anonymous dashboard denial, signed-in redirects, session updates unable to change access, and safe external callback handling.                                                                                         |
| Session invalidation   | Forged tokens, absolute 12-hour expiry, old session versions, and revoked accounts were denied by the real HTTP server and Atlas queries. Expiry was simulated with an encrypted test token, not by waiting 12 hours.                                                                 |
| Request attacks        | Cross-origin/missing-origin requests, non-JSON signup, malformed JSON, extra role/version fields, MongoDB operator objects, and oversized bodies were rejected. Display-name script markup was escaped in dashboard HTML.                                                             |
| Request limits         | Both signup and authentication POST streams are capped at 8 KiB. Local tests cover multibyte content, misleading Content-Length, and stream errors. Login per-email limits and signup global limits were exercised against Atlas. Signup throttling now returns 429 with Retry-After. |
| Cookies and caching    | HttpOnly/SameSite=Lax cookie flags and private-page/API no-store responses passed. HTTPS configuration produced Secure, host-prefixed CSRF and Secure session cookies. This checks configuration, not deployed TLS.                                                                   |
| Database outage        | An unreachable database produced a sanitized signup 503 and denied login, authenticated session lookup, and dashboard access. Unconfigured account pages remained available and the auth API returned 503.                                                                            |
| Headers                | Actual responses include nosniff, DENY framing, and same-origin referrer policy.                                                                                                                                                                                                      |
| Dependencies           | Audit recorded 9 October: zero production findings; five high development-tool findings tracing to braces. Dependency auditing was not repeated for onboarding.                                                                                                                       |

Security tests used fictional records in three new isolated Atlas databases.
Two additional isolated databases were used for browser history testing. All were
removed and separate read-only queries confirmed no collections remained.
Application data and .env.local were not changed. No email was sent.

## Running the automated checks

Use the repository runtime and installed dependencies; see [README](../README.md).

- npm test: local-only regression tests, with no remote database writes.
- npm run test:integration: optional service/callback tests against Atlas.
- npm run test:http: optional production-server HTTP/security checks against Atlas.

Before test:http, build the current code with npm run build (or the documented
Webpack fallback). Set ACCOUNT_TEST_DATABASE to a **new, disposable** database
whose name starts with mmm_account_test_. Both remote suites refuse the configured
application database and nonempty test databases, and delete their test database
on completion, including failures. Never point them at application data.

The HTTP suite uses loopback ports 3107–3110 and stops only its own child servers.
Optional ACCOUNT_TEST_BROWSER=1 pauses before cleanup for manual browser checks;
press Enter in the test terminal when finished. ACCOUNT_TEST_BROWSER_ONLY=1
starts just the isolated browser fixture; it does not run the HTTP assertions.
These browser checks were manual,
not a newly installed browser automation framework.

## Limits and remaining work

The current rate limits are development guards, not a tested distributed abuse or
load defense. Trusted deployment IP limits and tuning remain release work.
Actual Vercel HTTPS/proxy behavior, separate production secrets/data, HSTS, a
Next.js-compatible content-security policy, deployment monitoring, and capacity
checks still need deployment preparation. Future guest links, uploads, recovery,
and feature-specific admin/organizer permissions require their own tests.

Signing out clears this browser's cookie; it does not log out other devices or
invalidate a previously copied JWT. Database revocation/session-version changes
invalidate old tokens, and the absolute 12-hour limit remains enforced. A future
logout-all-devices policy or per-session revocation needs an explicit design.

The latest published braces release remains 3.0.3 with no upstream patch for
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
The affected dependency is used by lint tooling, not the deployed runtime.
Do not feed untrusted pattern input into that toolchain. npm's suggested major
ESLint-config downgrade was not applied; track an upstream compatible fix.

## Browser history validation — 9 October 2026

Login and logout replace the current browser history entry with a fresh document.
Auth/staff layouts hide their content before browser snapshots and reload on
Back/Forward or a persisted page restore, so the server rechecks the session.
Normal public-page navigation remains available; Back is not disabled.

Manual in-app Chromium checks passed on the current Webpack production build:

- Signup → login → dashboard, then Back and Forward: the older account form was
  redirected to the dashboard with no editable login/signup form shown.
- Direct login/signup navigation while signed in returned to the dashboard.
- After logout, Back and Forward through older dashboard entries returned to
  login without dashboard content. Direct anonymous dashboard access also did so.

The three local history tests cover popstate reloads, hidden snapshots, repeated
persisted restores, and listener cleanup; actual BFCache use varies by browser.
This is not cross-browser coverage. Ten local tests, lint, formatting, TypeScript,
and the Webpack production build passed. The full HTTP suite passed during the
first history investigation; the final build used the browser-only fixture.
Both history test databases were cleaned up and independently checked.
Changes are local and have not been committed, pushed, or deployed.

## Onboarding integration — 12 October 2026

The complete HTTP/security suite was rerun successfully with the new onboarding
backend. It now configures the disposable wedding through the real API before
checking the ready dashboard, and adds membership/role checks, revision conflicts,
validation, resume and completion checks. Admins with incomplete setup go from
/dashboard to /onboarding; completed setup is shared and skipped by later admins.
See [onboarding implementation](wedding-onboarding/Implementation.md) for exact
scenarios, browser save-failure/retry checks and independently confirmed fixture
cleanup. These tests do not change the production/deployment limits above.
The dependency findings above were last checked on 9 October, not reaudited here.

## Protected-read performance regression checks — 13 October 2026

The optimized authorization path passed the full live HTTP suite, with extra checks
for forged/absolute-expired tokens on settings, actual JWT expiry, future issue
times, revoked/current session versions, and denial of bearer-only requests.
Successive role changes in the same running server remain effective. The database
outage regression found on the first run was fixed; the repeated full suite passed.
Twenty-three local tests now include two shared token-policy regressions. See
[performance](Performance.md) for request-scoped caching boundaries, measured
timings and browser checks. These are not a complete security or capacity audit.

## Events integration — 14 October 2026

The full HTTP/security suite passed with event list/creation checks added. Anonymous
event pages/API calls are denied; admins and organizers can read/create, while
organizers remain denied Wedding Settings. Strict fields, same-origin bounded
writes, duplicate requests, transaction rollback and first-event/zone-edit races
were checked against fictional disposable data. The existing forged/expired/revoked
session and outage checks also passed through the shared authorization path.
Final desktop event browser checks confirmed logged-out Back/direct entry denial.
See [event scope and precise verification](events/Implementation.md); this does not
extend the claims to guest links, production abuse controls or deployed TLS.

## Event edit protections — 14 October 2026

Focused create/edit HTTP checks passed. Edit GET/PATCH deny anonymous, forged,
bearer-only, revoked and stale-version sessions; current admin/organizer access
works. Foreign-wedding/non-active events return 404. Mutations enforce origin,
JSON/body limits, strict scope/operational-field rejection, and event revisions.
Desktop sign-out → Back and direct edit requests stayed at login. The normal full
suite includes these checks; this run used its focused Events mode, not another
full authentication-suite run. See [event verification](events/Implementation.md).

## Event request-limit separation — 14 October 2026

Event bodies now have a 32 KiB cap; the account/authentication wrapper retains
8 KiB. Local transport tests verify both limits and streamed byte counting even
with missing/false Content-Length, including cancellation after exceeding the cap.
Focused HTTP checks accepted multibyte/max-escaped event saves, rejected oversized
event streams and confirmed oversized account signup still returns 413. Existing
local authentication regressions passed; the full authentication HTTP suite was
not repeated. See [event regression details](events/Implementation.md).
