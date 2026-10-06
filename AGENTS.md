# Working in Make My Marriage

## Scope and references

- One wedding; planning target: 1,000 unique guests and 1,000 events. Desktop-first,
  with mobile-friendly guest flows. Guests use scoped links without accounts.
- Read [README.md](README.md) for setup, future folders, and known limitations.
  Use [package.json](package.json) and `.nvmrc` for current versions and commands.
- Consult the relevant specifications before implementing a feature:
  - [PRD](docs/Make-My-Marriage-PRD.md) and
    [architecture](docs/Make-My-Marriage-System-Architecture.md).
  - [Database guide](docs/Make-My-Marriage-Database-Design.md) and
    [technical reference](docs/Make-My-Marriage-Database-Technical-Reference.md).
  - [API guide](docs/Make-My-Marriage-API-Design.md) and
    [technical reference](docs/Make-My-Marriage-API-Technical-Reference.md).
- Explicit user decisions take precedence over older documents. Proposed defaults
  and examples are not approval. Check for the referenced PRD v1.4 and architecture
  v1.1 before revising the older copies; see README for known discrepancies.
- Follow PRD permissions on the server. General event publication is admin-only;
  resolve the proposed API's organizer visibility conflict when implementing it.

## Architecture

- Keep one Next.js App Router application and one package manifest: a TypeScript
  modular monolith using the Node.js runtime and Zod validation.
- Keep pages and HTTP handlers thin. Feature business rules and repositories belong
  in `src/features/<feature>/server/`; browser-safe schemas and feature UI belong
  alongside them. Pages and jobs reuse services with authorization enforced.
- Shared connections, authorization helpers, provider clients, and job entry points
  belong in `src/server/`. Import `server-only` in database, secret-bearing,
  authorization, and server-service modules; keep browser imports separate.
- Keep the root layout minimal. The future `(staff)` layout owns dashboard UI;
  `(auth)` owns staff account screens, and `(guest)` owns guest screens. Route
  groups do not enforce permissions.
- Use Tailwind and shared CSS tokens. Apply approved Stitch designs when supplied.
  Create `public/` when public brand assets or fonts are introduced.
- Add working files as features arrive. Document future folders instead of creating
  empty endpoints, repositories, or integrations. Avoid speculative abstractions.

## Dependencies and configuration

- Use npm exclusively, exact direct dependency pins, and the committed lockfile.
  Verify stable releases and compatibility before installing or updating packages;
  do not bypass engine or peer requirements.
- Add provider SDKs when implementing their features. The approved providers are
  MongoDB Atlas, Auth.js credentials authentication, R2, Resend, Inngest, and Vercel.
  Verify Auth.js release/session compatibility before authentication work.
- The initial scaffold must run without external-service credentials. Validate
  configuration with Zod; keep secrets out of Git, logs, browser responses, and
  `NEXT_PUBLIC_*`. Track safe examples in `.env.example`; isolate environment data.

## Commands and validation

Run `nvm use` first. Use `npm ci` for a clean install when needed.

| Command                                   | Purpose                                          |
| ----------------------------------------- | ------------------------------------------------ |
| `npm run dev`                             | Local development                                |
| `npm run lint`                            | ESLint with zero warnings                        |
| `npm run format` / `npm run format:check` | Write / check formatting                         |
| `npm run typecheck`                       | Generate Next route types, then check TypeScript |
| `npm run build` / `npm start`             | Build / serve the production app                 |
| `npm run check`                           | Lint, formatting, types, then build              |

For code changes, run relevant checks and meaningful feature tests when available.
There is currently no test script. For documentation-only changes, check formatting
and local links. Existing `docs/` are excluded from automatic formatting. Do not
edit generated `next-env.d.ts`, `.next/`, or lockfile entries by hand.

If Turbopack encounters the documented local-port restriction, validate with
`npm run build -- --webpack` and report the limitation; do not claim the default
build passed. See README for the ESLint compatibility pin.

Keep changes scoped, preserve unrelated work, and report checks and limitations.
Commit, push, provision services, or deploy only when requested.
