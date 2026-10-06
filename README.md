# Make My Marriage

A desktop-first wedding application for one wedding, with a planning target of
1,000 unique guests and 1,000 events. Guest flows must also work on mobile.

This repository contains a minimal Next.js App Router application and six design
documents. The homepage at `/` implements the complete approved Stitch layout:
hero, story, celebrations, invitation access, gallery sharing, livestream preview,
venue, and footer. It includes mobile navigation, event-detail dialogs, local
artwork, and self-hosted fonts. Names, dates, venue, and album counts are sample
content. Service-dependent actions and staff sign in remain disabled.
Authentication, database access, and external-service integrations are not
implemented.

The homepage components live in `src/features/wedding/components/`. Asset sources
and next UI steps are recorded in [the design reference](docs/Homepage-Design.md).

## Local development

Use Node **24.21.0** and npm **11.19.0**. With nvm installed:

```sh
nvm install
nvm use
npm ci
npm run dev
```

Open <http://localhost:3000>. No environment file or external-service credentials
are required. `nvm use` selects the project runtime for the current shell.

For optional local overrides, copy `.env.example` to `.env.local`. Keep that file
untracked. `APP_ENV` defaults to `development`; `APP_URL` defaults to
`http://localhost:3000`. Set both explicitly when deploying to preview or
production. `APP_ENV` is application configuration, not a replacement for Next.js
`NODE_ENV` behavior and not an authorization mechanism.

## Commands

| Command                | Purpose                                                    |
| ---------------------- | ---------------------------------------------------------- |
| `npm run dev`          | Start the development server                               |
| `npm run lint`         | Run ESLint, rejecting warnings                             |
| `npm run format`       | Format source and configuration                            |
| `npm run format:check` | Check formatting without changes                           |
| `npm run typecheck`    | Generate Next route types and run strict TypeScript checks |
| `npm run build`        | Build the production application                           |
| `npm start`            | Serve an existing production build                         |
| `npm run check`        | Run lint, formatting, types, and production build in order |

Existing `docs/` files are excluded from automatic formatting. Next generates
`next-env.d.ts` and `.next/`; neither is maintained by hand. Feature tests will be
introduced with working behavior instead of placeholder tests for this shell.

In the restricted development environment used to verify this scaffold,
Turbopack's CSS worker cannot bind its local port. Lint, formatting, and type
checking pass; the supported fallback `npm run build -- --webpack` also passes,
and the resulting home page, styles, and 404 were checked over local HTTP without
service credentials. The default scripts retain Next.js's standard Turbopack
behavior. If you encounter the same port restriction, use the Webpack build;
the server still needs permission to listen on localhost.

## Dependencies

Stable package versions and peer requirements were checked against npm on
2 October 2026. Direct versions are exact in `package.json`; `package-lock.json`
records the complete resolved tree. Use npm exclusively and `npm ci` for clean
installs. Review updates explicitly instead of bypassing peer or engine checks.

The baseline is Next.js 16.3.8, React 19.3.0, TypeScript 6.0.3, Zod 4.6.5,
Tailwind CSS 4.3.3, ESLint 9.39.5, and Prettier 3.9.9. TypeScript 6.0 is selected
for compatibility with the TypeScript ESLint tooling. The runtime requirement is
Node 24.x; local development is pinned through `.nvmrc`.

ESLint 9.39.5 is deprecated upstream, but the React and accessibility plugins
included by the current Next.js config do not yet declare ESLint 10 support.
Keep this compatible pin until those plugins support ESLint 10; do not force a
peer-dependency override. This is a development-tooling limitation.

Provider SDKs, database access, authentication, image processing, and test
frameworks are deferred until their corresponding features are implemented.
The official MongoDB driver is the recommended persistence library. Auth.js
release status and credentials/session compatibility must be verified before
authentication is implemented; neither v4 nor a v5 beta is selected here.

## Source boundaries

The root layout owns only the HTML document, global styles, and basic metadata.
The future staff layout owns dashboard navigation and other staff UI. Route
groups organize pages; they do not enforce authorization.

Create the following folders only when implementing their first real files:

| Future location                               | Responsibility                                                 |
| --------------------------------------------- | -------------------------------------------------------------- |
| `src/app/(auth)/`                             | Login, invitation-only signup, verification, password recovery |
| `src/app/(staff)/`                            | Protected management pages and dashboard layout                |
| `src/app/(guest)/`                            | Shared wedding, personal invitation, and gallery pages         |
| `src/app/api/`                                | HTTP handlers added alongside working features                 |
| `src/components/`                             | Shared presentation components                                 |
| `src/features/<feature>/schemas.ts`           | Browser-safe validation schemas and types                      |
| `src/features/<feature>/components/`          | Feature-specific UI                                            |
| `src/features/<feature>/server/service.ts`    | Business rules and permission enforcement                      |
| `src/features/<feature>/server/repository.ts` | Feature-specific database queries                              |
| `src/server/db/`                              | Shared MongoDB connection                                      |
| `src/server/auth/`                            | Auth.js integration and shared authorization helpers           |
| `src/server/integrations/`                    | R2, Resend, and Inngest clients                                |
| `src/server/jobs/`                            | Background entry points calling feature services               |
| `scripts/`                                    | Explicit migrations and controlled admin initialization        |
| `tests/`                                      | Integration and browser tests                                  |

HTTP handlers validate transport inputs and call services. Server-rendered staff
pages may call the same services directly. Both paths enforce authorization.
Services own business behavior, repositories own queries, and provider clients
own provider-specific calls. Keep account signup/recovery rules in the accounts
feature and job business rules in their owning features.

Every database, secret-bearing integration, authorization, and server service
module must import `server-only`. Never re-export server modules from a
browser-safe schema or component entry point. The configuration module already
uses this boundary. Add lint restrictions when further boundaries exist.

The proposed API-scoped guest cookies are not sent to guest page URLs. If that
proposal is adopted, those pages must load protected data through the scoped API
rather than assuming server-rendered pages receive guest credentials.

## Configuration and secrets

Validate configuration with Zod on the server. Only basic app settings exist now;
require each provider's settings when its feature is implemented. Do not add dummy
credentials to make builds pass. Local, preview, and production environments must
use isolated data and provider configuration, with restricted test email delivery.

Never commit secrets, return them in browser responses, log their values, or use
`NEXT_PUBLIC_*` for secret configuration. Wedding time zone and currency are
future wedding settings, not inferred from this computer's locale. The scaffold
loads no external fonts, photos, analytics, or service clients.

## Design documents and pending decisions

- [Product requirements](docs/Make-My-Marriage-PRD.md)
- [System architecture](docs/Make-My-Marriage-System-Architecture.md)
- [Database design](docs/Make-My-Marriage-Database-Design.md)
- [Database technical reference](docs/Make-My-Marriage-Database-Technical-Reference.md)
- [API design](docs/Make-My-Marriage-API-Design.md)
- [API technical reference](docs/Make-My-Marriage-API-Technical-Reference.md)

This checkout contains PRD v1.3 and architecture v1.0, although the later
database/API documents reference PRD v1.4 and architecture v1.1. Those newer
copies were not found in the repository; check whether they exist elsewhere
before revising the older documents. The six source documents are unchanged.

The user's confirmed 1,000-guest / 1,000-event target supersedes the older 10-by-10
baseline. A fully assigned dataset may contain 1,000,000 invitations; this is a
planning target, not a tested capacity guarantee.

Follow the PRD's role boundaries: only admins publish event details to general
wedding-link holders, despite the proposed API currently allowing organizers to
change visibility. Resolve that contract discrepancy when implementing events.

Remaining product/service proposals stay open: RSVP deadline behavior,
cancellation and reinstatement, reminder timing and recovery, expense model,
stream count, token/session durations, upload settings, rate-limit backing store,
production capacity, regions, retention, and backup operations. Examples in the
documents do not approve these defaults. The scaffold creates no services, staff
accounts, wedding data, or placeholder API implementations.
