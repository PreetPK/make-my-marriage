# Staff account UI

First increment: 8 October 2026.

## Design and routes

The sign-in screen follows Stitch's **Make My Marriage - Workspace Sign In**,
screen `ad71a379f2ab456e8a2b9db41c559687` in project
`12751053601206958162`. Signup adapts this layout; a separate signup design was
not available. The homepage's staff icon now links to `/login`.

`src/app/(auth)/` owns the shared editorial layout, `/login`, and `/signup`.
Forms and browser-safe Zod schemas belong to `src/features/accounts/`.
The root layout remains minimal. Route groups do not authorize access.

## Implemented scope

- Responsive sign-in and invited-signup form previews.
- Email/required-field validation, password confirmation, labeled field errors,
  first-error focus, and password visibility controls.
- Clear preview notices and truthful unavailable messages for valid submissions.
- Signup collects name, email, password, and confirmation; no role selector.
- Links between the two screens and back to the homepage.
- No form requests in the JavaScript-enabled preview, credential persistence,
  authentication, account creation, or staff access. Controls remain disabled
  until hydration, so a JavaScript-disabled browser cannot submit the form.

Use sample details only. An email that passes form validation is not an accepted
invitation or proof of eligibility. Signup does not validate tokens or activate
access. Password validation only checks required input and matching confirmation;
it does not establish the eventual password policy.

The design's state-demo bar, simulated authentication failures, unsupported travel
logs/audio guestbooks, and placeholder legal/help links were not copied.
No false loading or success state is shown without a real request.

## Next increments

Consult PRD REQ-01 and the account contracts before connecting these forms:

1. Verify Auth.js release and credentials/session compatibility.
2. Agree on initial admin provisioning, password policy, and session/token rules.
3. Add MongoDB account access and server-validated staff invitations.
4. Implement credential verification, sessions, logout, and server role checks.
5. Add email verification, invitation redemption, and password recovery/reset.

Signup must remain invitation-only; guests never need accounts. Authenticated or
verified accounts alone must not grant wedding access. Keep secrets and service
clients server-only. No Auth.js/provider dependency or service was added in this
UI increment.

## Verification

Lint, formatting, type checking, and `npm run build -- --webpack` passed.
Browser checks covered validation, first-error focus, show/hide controls,
confirmation mismatch, cleared inputs after valid preview submission, no role
selector, no-JavaScript disabled controls, and 320px/390px layouts without overflow.
No credential POST requests or uncaught browser errors were observed.
Backend authentication and invitation enforcement are not implemented or tested.

## Backend increment — 8 October 2026

The preview-only behavior above describes the first increment. These screens now
call implemented backend handlers; see [staff authentication](Staff-Authentication.md)
for current behavior, approved rules, setup, tests, and limitations. Real signup
awaits Resend configuration and partner setup. Recovery/reset remain unimplemented.

## Public signup update — 9 October 2026

The user replaced the invitation rule: every public signup creates an admin
account, with no partner allowlist or two-account cap. The signup form is editable
without a token. Email verification still gates sign-in. See
[the current account rule](Staff-Authentication.md) for implemented behavior.
Earlier sections describe historical increments, not the current access policy.

## Verification deferred — 9 October 2026

The latest user decision removes email verification from the current flow. Signup
creates an active admin immediately, with no email settings required. Verification
and resend controls and routes have been removed. Login uses email and password.
Earlier sections record historical increments; see
[staff authentication](Staff-Authentication.md) for the current behavior.
