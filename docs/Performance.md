# Page-loading performance

Updated: **13 October 2026**.
Scope: authenticated page rendering and settings reads. See
[Wedding Settings](Wedding-Settings.md) and [authentication coverage](Authentication-Test-Coverage.md).

## What changed

- React request-scoped `cache` shares current staff and wedding reads between the
  layout, page and feature service. Primitive staff/wedding IDs are cache keys.
  There is no persistent user/permission cache or TTL; each new request rechecks
  current database membership. Route handlers run outside React render caching.
- Protected requests use Auth.js `getToken` to verify/decrypt the existing native
  cookie. The shared token policy checks the absolute 12-hour lifetime, valid
  session-version claims and future/malformed issue times. Current roles/status,
  membership and session version still come from MongoDB. This replaces running
  the session callback's database checks and immediately repeating them.
  Auth.js session/login/logout endpoints remain native. Bearer authentication is
  deliberately not enabled. The server never trusts client role claims.
- Authentication reuses the same membership-scoped wedding read as onboarding and
  settings; layout/page reads see one render snapshot. Saves still read fresh
  access/data and use the atomic expected revision check.
- Settings data and lock checks run in parallel. No mutations are cached.
- Wedding Settings streams a neutral loading skeleton only after the page's
  staff/admin authorization check. The outer staff layout still gates onboarding.
  Sidebar links show Opening while navigation is pending. Skeletons respect
  reduced motion and contain no saved wedding data.

These use existing dependencies. The connection pool was already shared; no
service plan, region, secrets, deployment or dependency version changed.

[React request-scoped cache](https://react.dev/reference/react/cache),
[Next.js link status](https://nextjs.org/docs/app/api-reference/functions/use-link-status).

## Measured before and after

Local Node/Next Webpack production server to the existing Atlas development
cluster, using separate disposable synthetic databases. Identical benchmark:
create one test admin, complete onboarding, then fetch each protected page four
times. First sample is reported separately; the warm median uses the last three.
Timers distinguish response headers/first byte from completion of the full HTML
stream. These are HTTP server measurements, not browser paint or load-capacity
benchmarks. No absolute timing assertion is used because network/Atlas latency
varies.

| Page             | Before warm full response | After warm full response | Observed reduction |
| ---------------- | ------------------------- | ------------------------ | ------------------ |
| Dashboard        | 2,277 ms                  | 886–944 ms               | 59–61%             |
| Wedding Settings | 2,775 ms                  | 1,358–1,473 ms           | 47–51%             |

Dashboard first sample: 4,470 ms before, 1,044 ms after. Settings first sample:
3,504 ms before, 3,767 ms after; cold parallel connections still have variable
startup overhead. Settings warm first-byte samples after the change were
1,060 / 900 / 982 ms, with full completion at 1,520 / 1,350 / 1,473 ms.
A second run of the final code measured warm medians of 944 ms (Dashboard) and
1,358 ms (Settings), confirming the improvement with expected timing variation.
The loading skeleton improves feedback while remaining reads finish; first-byte time
is not equivalent to a usable form.

Read-only diagnosis measured a fresh database connection at 3,834 ms, warm ping
447–512 ms, staff check 947 ms and wedding read 441 ms. Preference checks took
2,830 ms on their first parallel call and 441–478 ms warm. These include network
and server wait; no database region or provider bottleneck has been proven.

Reproduce with `ACCOUNT_TEST_PERFORMANCE_ONLY=1` plus a fresh, empty
`ACCOUNT_TEST_DATABASE=mmm_account_test_...` when running `npm run test:http`.
The existing fixture rejects application/nonempty databases and removes its own
fixture afterward. See [test fixture precautions](Authentication-Test-Coverage.md).
The first measurement attempt stopped on a test assertion that did not account
for React HTML text separators; the assertion was corrected before recording the
baseline. Databases pf01/pf02/pf03 were removed by their fixtures; pf04 found an outage
regression (500 instead of login redirect). That was fixed before the full pf05
suite passed. The final pf06 benchmark/browser fixture was also removed.
A separate read-only check confirmed all six fixture databases had no collections.

## Verification and limits

All 23 local tests, lint, formatting, types and the Webpack build passed. The full
expanded HTTP/security suite passed, including restored fail-closed outage behavior.
A desktop browser confirmed immediate Opening feedback, populated settings, no
overflow or console errors, and signed-out Back remaining at login. A real
authenticated streamed HTML check confirmed the loading fallback preceded the
completed form. Verification is recorded in [project progress](Project-Progress.md). Local policy
regressions cover the exact 12-hour boundary, future timestamps and malformed
claims. Live HTTP coverage checks current roles/revocation and session versions
across successive requests, expired/forged tokens, cookie-only access, settings
writes, conflict/lock behavior, and storage failures. This performance mode does
not replace the full security suite.

No mobile/cross-browser performance audit or 1,000-guest/event load test is claimed.
Database network latency and cold connections remain material. Review compute/DB
region proximity and provider capacity during deployment planning; do not provision
or change them silently. Add measured performance checks with future data-heavy
features, bounded queries and relevant indexes when their collections arrive.
