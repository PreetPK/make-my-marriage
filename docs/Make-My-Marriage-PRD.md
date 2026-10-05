# Make My Marriage

## Product requirements document

**Version:** 1.3  
**Date:** 21 September 2026  
**Status:** Draft for review, based on agreed scope  
**Product owners:** The couple  
**Release:** First version for one wedding

This document defines the product requirements and records the agreed system choices: Next.js, Node.js, TypeScript, Zod, a modular monolith, MongoDB Atlas Free, Vercel, Cloudflare R2, Auth.js, Resend, and Inngest. See Make-My-Marriage-System-Architecture.md for component responsibilities and open technical details. This document does not authorize implementation; database design, API design, and UI/UX follow architecture review.

## 1. Purpose and goals

Make My Marriage is a web application for the couple's own wedding. It combines a wedding website for guests with a private management area for the couple and their organizers.

The product should let the couple maintain wedding details in one place, organize multiple events, invite guests to selected events, track individual attendance, record expenses, and share wedding memories. Guests should be able to respond, browse photos, upload photos, and watch a YouTube livestream without creating an account.

Success means:

- The couple can set up and manage the wedding without developer assistance for routine content changes.
- Every guest sees and responds only to the events included in their invitation.
- Organizers can manage events, guests, and RSVPs without complex permission configuration.
- Expenses and access settings are available only to the couple.
- Photos appear immediately after upload, while deletion remains admin-only.
- The guest experience works comfortably on mobile browsers as well as desktop browsers.

## 2. Scope baseline

| Included in the first release | Boundary |
| --- | --- |
| Single-wedding web application | One wedding; no multi-couple accounts or wedding switching |
| Elegant floral wedding website | Fixed template with editable content; no page builder |
| Shared-link access | Guests do not log in; access depends on possession of the relevant link |
| Staff account access | Sign up, email verification, login, forgot password, and reset password; two admins and one standard organizer role |
| Multiple events | Separate details, venues, schedules, and invitations |
| Individual guest management | Name and valid email required; no household RSVPs or plus-one workflow |
| Event-level invitations and RSVPs | Each guest can be invited to multiple selected events |
| Digital invitations | Email delivery of personal invitation links with event-specific RSVP forms |
| Email RSVP reminders | Admin-triggered reminders plus one automatic reminder seven days before each event's RSVP deadline, only for pending responses |
| Wedding dashboard | Event and RSVP overview; expense summary for admins only |
| Expense records | Costs, payments made, and outstanding balances |
| Organizer management | Admins grant and revoke organizer access |
| Planner discovery | Search by area using clearly labeled sample listings initially |
| Shared photo gallery | Event folders, immediate uploads, shared viewing, QR codes, original-quality downloads for gallery-link holders, and manual admin-only deletion |
| Livestream | Embedded YouTube stream |

### Explicitly excluded

- Budget targets, budget forecasting, and budget-versus-actual tracking.
- Task planner, checklists, task assignments, and task reminders.
- Native mobile apps.
- Multiple weddings or a platform for other couples.
- Household invitation management and plus-one registration.
- Event-specific organizer permissions or custom roles.
- Repeated automatic reminder campaigns beyond the agreed single seven-day reminder, SMS, and WhatsApp messaging.
- Real planner API integration in the first release; live listings may be considered later.
- Planner bookings, contracts, payments, reviews, or planner self-service accounts.
- A drag-and-drop wedding website builder.
- Custom video broadcasting or video hosting.
- Photo approval queues, likes, comments, face recognition, video uploads, and professional-camera RAW files.
- Separate original-photo backups for now; database backups remain included.
- Expense payment processing or accounting integrations.

## 3. Users and permissions

There are two authenticated roles: admin and organizer. Guests use links instead of accounts. Planner directory entries are businesses displayed for discovery; listing a planner never grants application access.

| Capability | Admin: both partners | Organizer | Guest with relevant link |
| --- | --- | --- | --- |
| Edit wedding website and general wedding settings | Yes | No | No |
| Manage all events | Yes | Yes | No |
| Add and edit guests and event invitations | Yes | Yes | No |
| View and update guest RSVPs | Yes | Yes | Own invitation only |
| Copy personal invitation links | Yes | Yes | Can use their received link |
| Send or resend invitation emails | Yes | Yes | Receive their own invitation |
| Trigger manual reminders and configure scheduled reminders | Yes | No | No |
| View or manage expenses | Yes | No | No |
| Grant, revoke, or change access | Yes | No | No |
| View planner directory | Yes | Yes | No |
| Browse and upload gallery photos | Yes | Yes | Yes, with gallery access |
| Download original-quality photos | Yes | Yes | Yes, with gallery access |
| Download/share gallery and event-folder QR codes | Yes | Yes | Can use or forward a received code |
| Delete gallery photos | Yes | No | No |
| Configure YouTube livestream | Yes | No | No |
| Watch configured stream | Yes | Yes | Yes, with wedding access |

Both partners have equivalent full admin access. Organizer access applies to the whole wedding. Protected information and actions must be enforced on the server, including direct requests that bypass the interface.

## 4. Guest access and link behavior

### REQ-01: Sign up, login, and password recovery

Admins and organizers have account sign-up, email verification, login, forgot-password, and reset-password flows. Guests continue to use links and QR codes without creating accounts.

**Confirmed access rule:** Staff sign-up is invitation-only. The two partners' admin identities are authorized during initial setup; admins invite organizers by email. An account or a verified email alone never grants wedding access, and users cannot select their own privileged role.

- Sign-up collects a name, email, password, and password confirmation. Verify the email before activating management access.
- Admins and organizers must sign in to use the management area and can sign out.
- Forgot password accepts an email and sends a time-limited, single-use reset link to an eligible account. The page uses a neutral confirmation whether or not that email has an account.
- Reset password lets the user set and confirm a new password. Invalid, expired, or used links display a clear recovery path to request another link.
- Successful password reset invalidates previous sessions and requires sign-in with the new password; it does not restore revoked wedding access.
- Admins can grant and revoke organizer access. Revoked users lose management access, including through an existing session.
- There is no guest registration or guest login step.
- The authentication provider, password rules, invitation/reset expiry periods, and initial admin provisioning mechanism remain implementation decisions.

**Acceptance criteria**

- Each preauthorized partner and invited organizer can sign up, verify their email, and sign in with the assigned role.
- An uninvited signup attempt, forged role selection, or unverified account cannot access wedding management data.
- Duplicate account emails do not create a second account; the user can use login or recovery instead.
- A reset link works once within its validity period; expired or reused links cannot change a password.
- After a reset, the old password and previous sessions no longer grant access, while the new password works for an active account.
- Passwords and recovery tokens are not exposed in logs, user records returned to the browser, or emails other than the intended single-use recovery link.

### REQ-02: Separate shared and personal links

- A general wedding link opens the guest wedding website.
- A personal invitation link identifies one guest and exposes only that guest's invited events and RSVP form.
- A gallery sharing link grants gallery viewing, upload, and original-photo download access, without exposing the guest list, personal invitations, or expenses.
- A gallery QR code encodes that gallery link. An event-folder QR code opens the same shared gallery with a specific event folder selected for viewing and uploads. Neither code contains a personal RSVP link or grants management access.
- A general wedding link alone must not reveal restricted event details or permit RSVP changes for another guest.
- The website may show only event details the admins explicitly choose to share with all wedding-link holders. Default behavior is to keep event details invitation-specific.
- Link values must be unpredictable and validated by the server. Invalid or revoked links show a neutral unavailable message without wedding or guest details.
- Admins can revoke or replace shared and personal links. Replacing a personal link preserves that guest's existing RSVP records.
- Replacing a gallery link invalidates QR codes based on the old link. The sharing screen explains that previously emailed, downloaded, or printed codes must be replaced.
- Pages containing wedding or guest information should request that search engines do not index them. Search-index settings do not replace access checks.

**Access limitation:** A person who receives a forwarded working link or QR code has the access granted by its underlying link. With no guest login, possession of an invitation link is sufficient to submit that invitation's response. Mandatory guest email supports delivery and reminders; it does not authenticate whoever opens a forwarded link. This is a deliberate consequence of the agreed access model.

## 5. Functional requirements

### REQ-03: Wedding setup and website

Admins can edit the couple's display names, wedding date, story, venue information, and website photos within a fixed elegant floral template. Empty optional sections should be hidden rather than showing placeholder text to guests.

The guest website provides wedding information, access to the guest's invitation when available, gallery access, and the configured YouTube stream. Administrative controls are confined to the management area.

**Acceptance criteria**

- Saved changes appear on the guest website after reload and on another device.
- The template remains usable with longer names, missing optional content, and small screens.
- Guests can view the website through the shared link without signing in.
- The general website does not disclose invitation-only events unless an admin has explicitly made them generally visible.

### REQ-04: Events

Admins and organizers can create and edit events with a name, date, start time, optional end time, venue name, address, and optional description or guest instructions. Each event has its own invited guest list and RSVP counts.

Removing or cancelling an event must explain the effect on its invitations before confirmation. Historical RSVP information must not disappear through an unexplained destructive action. Exact archive/cancellation behavior will be resolved during screen design.

**Acceptance criteria**

- At least two events can have different venues, schedules, and guest lists.
- Editing one event does not change another event's details or attendance records.
- The application uses a configured wedding time zone consistently for displayed event times.

### REQ-05: Guests and digital invitations

Admins and organizers can add, edit, search, and remove individual guests and assign them to selected events. A guest record requires a name and valid email address. Email is the primary channel for invitations and RSVP reminders; a guest cannot be saved without it.

One Send action can cover selected recipients using configurable background batches. A future 1,000-recipient send is a scalability example, not a change to the 10-guest planning baseline; higher volumes require review of sending quotas and capacity.

Each guest has one personal invitation link covering all events they are invited to. Staff can select one or more guests, preview the invitation and recipient count, and explicitly send invitation emails. Each guest receives an individual email containing their personal invitation link, a gallery link, and a scannable gallery QR code. The text gallery link remains usable when guests read the email on the phone they would otherwise use to scan the code.

The interface also allows staff to copy a personal invitation link or deliberately resend an invitation. Saving a guest or editing event assignments does not automatically send email. Invitations and reminder sends have separate histories so invitation resends do not become a substitute for admin-only pending-RSVP reminders.

Apply the same email safeguards as REQ-07: per-recipient results, safe retries, duplicate-send protection, truthful provider status, and no exposure of other guests' addresses or personal links. Failed sends preserve the guest record and allow staff to correct an address before retrying.

**Acceptance criteria**

- A guest assigned to the ceremony and reception sees those two events and no unassigned event details.
- Adding another event to the guest's invitation creates a new pending response without resetting existing responses.
- Removing an event assignment removes it from that guest's current invitation and excludes it from active RSVP totals.
- The app never assumes that two guests with the same name are the same person.
- Missing or malformed emails are rejected when creating or updating a guest. A syntactically valid email is not treated as proof of deliverability.
- If an email is already used on another guest record, warn staff about a possible duplicate rather than silently merging records. Guests and their responses remain individual even if staff confirm a shared mailbox.
- A selected guest receives their own invitation by email without needing an account. Another guest's invitation URL or email address is never included.
- Staff can see which invitations are unsent, accepted by the email provider, or failed; delivered/bounced statuses are shown only when confirmed by the provider.
- Updating a guest's email does not silently send an invitation or reset their RSVP records.
- A provider outage or missing sender configuration cannot produce a false successful-send message.
- There are no household response or plus-one fields.

### REQ-06: Event-level RSVPs

Each guest-event invitation has one status: **Pending**, **Attending**, or **Declined**. Guests answer independently for each invited event and receive a clear save confirmation. Admins and organizers can record or correct a response on behalf of a guest.

**Proposed response rule:** Guests may update their responses while their invitation link remains active. Each event requires an RSVP deadline to enable its scheduled reminder. Whether responses lock after that deadline remains open; no automatic locking is assumed.

**Acceptance criteria**

- A guest can attend one event and decline another.
- Repeated submission updates the same response rather than creating duplicates.
- Responses survive refresh and appear in the management dashboard.
- A manipulated request cannot change another guest's response or respond to an uninvited event.
- If saving fails, the page preserves the selected answers and offers a retry without claiming success.

### REQ-07: Manual and scheduled email reminders

Admins can filter guests with pending responses, select recipients, preview the message and recipient count, and explicitly send a reminder. The email includes the recipient's personal invitation link and refers only to that recipient's pending invited events.

Admins can also enable or disable automatic reminders. A daily scheduled job checks for a single reminder due seven calendar days before each event's RSVP deadline. It sends only to guests still pending for that event and records event-level reminder history. Manual reminders remain available independently.

Evaluate reminder dates in the configured wedding time zone. The exact daily execution time, handling of late invitations, deadline edits, and late recovery after an outage remain review items in the architecture document.

- Skip guests who have no pending responses.
- Revalidate required guest email addresses before sending and flag invalid or known failed addresses for correction.
- Record each send attempt, its time, recipient, and outcome.
- Show per-recipient failures and support retrying failed sends without automatically resending successful ones.
- Prevent a double click or request retry from silently creating duplicate sends.
- Do not claim delivery when the email provider has only accepted a message for sending.
- Never expose other recipients' addresses or invitation links.

**Acceptance criteria**

- Only an admin can initiate a manual reminder or change automatic-reminder settings. The scheduled job operates under those settings and rechecks eligibility before sending.
- One automatic reminder is due seven days before the event's RSVP deadline. Completed responses and previously sent scheduled reminders are skipped, including after duplicate job execution.
- An event without an RSVP deadline cannot have its seven-day reminder enabled; the event date is not silently used instead.
- No emails are sent merely by saving a guest, opening the reminder screen, or loading a dashboard.
- A guest who has completed all responses is excluded when eligibility is checked at send time.
- Without a configured sender/provider, the UI explains that email setup is required and does not report a successful send.

### REQ-08: Dashboard

The dashboard displays upcoming events, unique guest count, and per-event invitation and RSVP totals. Admins also see total recorded expenses, payments made, and outstanding amounts. Organizers receive no expense information in either the page or its data responses.

**Acceptance criteria**

- Per-event Attending + Declined + Pending equals that event's active invitation count.
- Unique guests and event invitations are labeled separately; one guest invited to three events is one guest and three invitations.
- Counts reflect saved changes and have useful empty states before records exist.

### REQ-09: Expenses

Admins can create, edit, and delete expense records. A record contains a description, category, total cost, amount paid, optional event, and optional notes. The application calculates outstanding amount as total cost minus amount paid.

**Proposed first-release defaults:** One wedding currency; one cumulative amount-paid field per expense. Multiple payment transactions, refunds, and receipt uploads are outside this release.

**Acceptance criteria**

- A cost of 1,000 with 400 paid displays 600 outstanding, in the configured currency.
- Negative values and payments exceeding the cost are rejected under the first-release payment model.
- Summary amounts match the saved expense records and use decimal-safe money calculations.
- Organizers and guests cannot read or change expense data through direct requests.
- No budget targets or budget comparisons appear.

### REQ-10: Organizer management

Admins can add organizers, view their access status, and revoke access. There is one organizer permission set for the entire wedding. An organizer cannot promote themselves, add another organizer, or change admin access.

**Acceptance criteria**

- An active organizer can manage events, guests, and RSVPs across the wedding.
- A revoked organizer cannot continue making authenticated management requests.
- Neither partner can accidentally remove the last available admin access through routine organizer management.

### REQ-11: Event planner discovery

The management area provides a directory of sample event planners searchable by area and planner name. Listings contain a business name, area served, services, and a short description. Contact details or website links appear only when usable, verified details exist.

**Acceptance criteria**

- Sample listings are prominently labeled as fictional/demo data and are not presented as real nearby businesses.
- Area matching works against the sample dataset and shows a clear no-results state.
- Results do not imply live distance calculations, availability, verified ratings, or real-time API data.
- Choosing or viewing a planner does not grant organizer access.

### REQ-12: Photo gallery, event folders, and QR sharing

Each wedding event automatically has a corresponding gallery folder, such as Ceremony or Reception. Guests open a folder to browse its images and upload photos directly into it. These are event albums inside the application; guests do not need to create or upload folders from their device.

The main gallery shows the event folders. A general gallery link or QR code opens that folder list. An event-folder link or QR code opens the chosen folder directly, with that event already selected as the upload destination. The selected folder name remains visible before upload, and uploads must always belong to an existing event folder.

Successful uploads become visible immediately in the selected folder without admin approval. Guests may select multiple supported images, with progress and success/failure shown per file. Admins and organizers can also upload; only admins can delete any photo, including one uploaded by someone else.

**Original quality and retention:** Preserve each successfully accepted original file without resizing, recompression, or destructive format conversion. Separate optimized previews may be generated for gallery browsing, but must never overwrite the original. Everyone with a valid gallery link, including visitors arriving through a QR code, can download the original file. Failed preview generation must not lose or modify the stored original.

Photos remain available until an admin manually deletes them. There is no automatic post-wedding expiry or age-based removal of successfully stored photos. Retention requires continuing storage and hosting; it is not a promise of cost-free perpetual service. Separate original-photo backups are explicitly deferred, so an independent recovery copy is not initially provided. Removing a photo or revoking a link cannot recall copies already downloaded by visitors.

**Accepted formats and limits:** JPEG/JPG, PNG, HEIC, and HEIF; 50 MB per photo and up to 20 photos per selection. Upload a few at a time with per-file progress and retry. Formats, limits, and concurrency must be validated on the server; exact byte units and concurrent-file count are implementation details. Professional-camera RAW files are excluded initially.

**Display variants:** Use compressed thumbnails for gallery tiles and larger optimized previews when a photo is opened. Produce browser-friendly variants for HEIC/HEIF, preserving the original file for downloads. A pending or failed preview shows its processing state; it never replaces or destroys the accepted original.

Admins and organizers can preview and download a scannable QR image for the whole gallery or an individual event folder, alongside its copyable link. They can share downloaded codes digitally or print them for display at the event. Invitation emails include the general gallery QR code and a clickable gallery link. Dedicated poster design and a separate bulk gallery-email campaign are not required.

**Acceptance criteria**

- An uploaded photo appears for another authorized visitor after refresh.
- Downloading an original returns a file with the same contents as the accepted upload; verify this with a file checksum during validation. Gallery previews are explicitly separate files.
- A gallery-link holder can download originals without logging in; an invalid or revoked gallery link cannot initiate a new download. Temporary download URLs, if used, must have a defined short expiry.
- Passing the wedding date or a photo's age threshold does not automatically remove stored originals or their gallery records.
- Only an explicit admin deletion removes a photo through the application. Cancelling an event must not trigger automatic deletion of its photos.
- Creating an event creates its corresponding gallery folder, even when it has no photos. Renaming the event updates the folder label without losing photos or breaking valid folder links.
- Uploading to Reception saves and displays those photos in Reception, not Ceremony or an unassigned collection.
- Scanning an event-folder QR code on a phone opens that folder with viewing and upload available, without a login prompt.
- Scanning a general gallery QR code opens the folder list. QR downloads have sufficient contrast and surrounding clear space to scan from a phone screen and a normal printed sample.
- Each QR code represents the current valid gallery access link and the intended folder, with no guest email or personal RSVP token embedded.
- A partly failed multi-image upload retains successful files and permits retrying failed files without automatically uploading the successful files again.
- An invalid or unavailable event folder cannot receive uploads. Event cancellation/removal must preserve existing photos or explicitly resolve their handling before changing access; it must not silently delete photos.
- Guests and organizers have no working delete action, including for their own uploads or through a direct request.
- Admin deletion requires confirmation and removes the image from gallery results and application-served access.
- A copied gallery link opens without login and exposes no guest contact details or expense information.
- Unsupported files, oversized files, and failed uploads show useful errors; unsuccessful uploads do not leave broken gallery items.
- Accepted photo types, the 50 MB per-file limit, and 20-file selection limit are displayed before upload. Oversized files receive an explanation rather than silent original-quality reduction.
- Uploads and image access are checked on the server; accepting a filename extension alone is insufficient validation.

Gallery sharing deliberately lets gallery-link and QR-code holders see shared photos across event folders. An event-folder code selects a destination rather than creating a private album. Folder labels and photos are shared, but private event schedules, addresses, invitations, and RSVPs are not exposed through gallery access. Event invitation restrictions do not imply private event-specific photo folders in this release.

### REQ-13: YouTube livestream

Admins can configure a YouTube video or livestream link. The wedding website displays an embedded player for guests with wedding access.

**Acceptance criteria**

- A supported YouTube link produces an embedded player without accepting arbitrary embed HTML.
- With no link configured, the page shows a suitable unavailable state or hides the stream section.
- A disabled, unavailable, or non-embeddable stream does not break the rest of the site; guests can open the configured YouTube link when appropriate.
- Stream scheduling, broadcasting, and YouTube visibility are managed through YouTube.

**Proposed first-release default:** One wedding-wide stream. Multiple simultaneous event streams are not included.

## 6. Screen inventory

These are logical screens, not a finalized navigation design.

| Screen | Primary users | Main actions |
| --- | --- | --- |
| Staff sign-up and email verification | Preauthorized admins, invited organizers | Create and activate an account with its assigned access |
| Login, forgot password, and reset password | Admins, organizers | Sign in, request a reset email, and set a new password |
| Dashboard | Admins, organizers | Review events and attendance; admins review expenses |
| Wedding website settings | Admins | Edit content, photos, shared links, and stream |
| Events and event details | Admins, organizers | Manage event details and invited guests |
| Guests and invitation details | Admins, organizers | Manage required guest emails, assignments, links, invitation email sends/results, and responses |
| Email reminders | Admins | Preview/send manual reminders, configure seven-day reminders, and review results |
| Expenses | Admins | Record costs and amounts paid |
| Organizers | Admins | Grant and revoke organizer access |
| Planner directory | Admins, organizers | Search sample listings |
| Gallery management and sharing | Admins, organizers | Browse event folders, upload, and download/share QR codes; admins can delete |
| Shared wedding website | Wedding-link holders | Read wedding information and watch the stream |
| Personal invitation | Invitation-link holder | View invited events and submit individual RSVPs |
| Shared gallery and event folder | Gallery-link or QR-code holders | Browse folders and upload photos into the selected event folder |

## 7. Primary workflows

### Set up the wedding

1. Authorize the couple's admin identities, complete sign-up and email verification, and sign in.
2. Enter wedding content, time zone, and currency.
3. Create events with venues and schedules.
4. Preview the guest website and configure the shared link.
5. Invite organizers if needed; they complete sign-up and email verification to activate their assigned access.

### Recover a staff account

1. An admin or organizer selects Forgot password and enters their email.
2. The application shows a neutral confirmation and emails a reset link when eligible.
3. The user opens the valid link and sets and confirms a new password.
4. The application invalidates the reset link and previous sessions; the user signs in with the new password.

### Invite a guest and collect responses

1. An admin or organizer adds an individual guest with a required name and valid email, then assigns selected events.
2. Staff select the recipient, preview the invitation, and send it by email. The email includes the personal invitation link and general gallery link/QR code; send results are recorded.
3. The guest opens the invitation link from their email without logging in.
4. The guest chooses a response for each invited event and submits.
5. Saved responses update the relevant event totals and dashboard.

### Follow up on pending responses

1. An admin opens pending RSVPs and selects recipients.
2. The app validates emails and previews the reminder and recipient count.
3. The admin sends; the app reports per-recipient outcomes.
4. Failed sends can be reviewed and retried deliberately.

### Send scheduled RSVP reminders

1. Configure an event's RSVP deadline and enable its automatic reminder as an admin.
2. A daily job identifies reminders due seven days before that deadline.
3. It rechecks pending responses, assignments, event status, and prior reminder history.
4. Eligible guests receive their personalized reminder through the background email flow.
5. Completed responses and already-sent scheduled reminders are skipped; failed work remains visible for recovery.

### Share wedding photos

1. Staff download a general gallery or event-folder QR code to share, or send an invitation email containing the general gallery code and link.
2. A guest scans the code or opens the clickable link without logging in.
3. The guest chooses an event folder, or arrives directly in the folder selected by an event QR code.
4. They select photos and confirm the visible destination folder before uploading.
5. Successfully stored photos become visible immediately in that folder; failed files can be retried.
6. Either admin can remove a photo; other visitors cannot.

## 8. Conceptual data model

| Record | Minimum information and relationships |
| --- | --- |
| Wedding | Couple names, date, time zone, currency, story, website content, livestream URL |
| Staff account/access | User identity, name, email, verification state, assigned admin or organizer role, invitation/access status; credentials and recovery handled securely by the selected authentication approach |
| Event | Wedding, name, schedule, venue, address, instructions, general visibility setting |
| Guest | Wedding, individual name, required email; guest identity remains separate from email address |
| Event invitation | Guest, event, response status, response timestamp; unique per guest-event pair |
| Access link | Wedding/gallery/individual invitation scope, token verifier, active/revoked state; gallery links may include an event-folder destination, and QR images encode these same links |
| Expense | Description, category, cost, amount paid, optional event and notes |
| Email attempt | Invitation or reminder type, individual recipient, event context, send time, status, provider reference/error, duplicate-send prevention reference |
| Event gallery folder | One folder per event, stable event relationship, label derived from the event; no separate guest permissions |
| Photo | Required event-folder relationship, original object reference, original content type and size, integrity checksum, optional preview reference/status, upload time |
| Planner listing | Name, service area, services, description, explicit sample-data indicator |

This model describes product information rather than prescribing a database or framework. Durable records and uploaded files must be shared across users and devices; browser-only storage is not sufficient.

## 9. Quality and operational requirements

- **Responsive use:** All core flows must work on current mainstream mobile and desktop browsers without horizontal clipping.
- **Accessibility:** Use labeled controls, keyboard navigation, visible focus, readable contrast, and accessible status/error messages. Check against WCAG 2.2 AA during implementation.
- **Persistence:** Saved records and images survive reloads, sign-out, and access from another device.
- **Authorization:** Verify role and link scope on every protected read and write. Hiding buttons alone is insufficient.
- **Link privacy:** Avoid including complete access tokens in analytics, application logs, or error reports. Third-party embeds must not receive private invitation paths through referrer information.
- **Validation and abuse limits:** Validate inputs on the server and apply reasonable limits to sign-up, login, password recovery, anonymous uploads, RSVP requests, and email sends.
- **Failure handling:** Show loading, empty, success, and recoverable error states. Never show a successful save before persistence succeeds.
- **Performance:** Generate separate compressed/resized gallery previews and load galleries incrementally. Never modify or replace original uploads to improve page speed.
- **Data protection:** Use encrypted transport and protect credentials. Original photos have manual admin-only removal with no automatic age-based expiry; separate photo backups are deferred. Database backups run weekly in development and daily before live use, with the runner, destination, retention, and restoration procedure to be designed.
- **Logging and environments:** Use basic application/error/job logs without passwords or private tokens. Separate development/testing from production, with isolated data and email behavior and a basic deployment/rollback procedure.
- **Safe changes:** Confirm destructive actions and explain their effect on linked data. Avoid silently erasing attendance history.

The confirmed planning baseline is **10 guests and 10 events**, allowing up to **100 guest-event invitations** if every guest is invited to every event. These are planning estimates rather than application-enforced limits. Photo volume, typical file sizes, and peak concurrent visitors still need to be estimated; forwarded gallery links can increase visitors beyond the invited guest count. This document makes no unverified performance or scale guarantees.

### Agreed technology constraints

- **Frontend framework:** Next.js.
- **Server runtime:** Node.js.
- **Application language:** TypeScript for frontend, backend modules, and background-job code.
- **Architecture:** Modular monolith with clear feature boundaries; detailed process and deployment layout to be documented in the system design.
- **Validation:** Zod for runtime input validation.
- **Database:** MongoDB Atlas Free for application records and photo metadata.
- **Hosting:** Vercel; primary audience in India, with final region configuration to be selected.
- **Authentication:** Auth.js integration with application-owned invitation-only registration, email verification, and password recovery.
- **Email:** Resend for invitation, reminder, verification, and recovery delivery.
- **Background processing:** Inngest for event-triggered work and daily scheduled reminder checks, running application handlers on Vercel.
- **Photo storage:** Private Cloudflare R2 for originals, thumbnails, and previews.
- **Operating budget:** No fixed amount agreed. Estimate application hosting, database, email, storage, backups, and original-photo download costs before selecting paid services.

TypeScript types do not replace runtime input validation or server-side authorization. Exact software versions, database access libraries, Auth.js session details, image codecs, operational limits, and database-backup tooling remain technical design decisions.

## 10. Dependencies and decisions before implementation

The functional scope and technology constraints above are agreed. The table below distinguishes confirmed decisions from remaining design and setup details.

| Decision or dependency | Current position |
| --- | --- |
| Couple names, wedding date, events, venues, story, and photos | To be supplied; placeholders may be used for design review |
| Admin account details and authentication | Auth.js chosen; account workflows required; initial two-admin provisioning and session/revocation implementation still to be specified |
| Wedding time zone and currency | To be supplied; do not infer from the development environment |
| Organizer onboarding | Confirmed: admin email invitation followed by sign-up/verification; invite-only wedding access with one standard role |
| Email provider and sender identity | Resend chosen; domain not purchased, verified sender and reply-to still required |
| Hosting and storage | Vercel, MongoDB Atlas Free, and Cloudflare R2 chosen; Inngest coordinates background jobs |
| Scheduled reminders | One reminder seven days before each event's RSVP deadline; daily execution. Exact hour and edge-case rules remain to be reviewed |
| RSVP changes | Proposed: editable while personal link remains active |
| Expense payment model | Proposed: cumulative amount paid, one currency, no overpayments |
| Gallery upload limits | JPEG/JPG, PNG, HEIC, HEIF; 50 MB per file; 20 files per selection. Total volume, decoder, and concurrency remain to be validated |
| Original photos and downloads | Confirmed: untouched originals; everyone with a valid gallery link can download them; previews stored separately |
| Gallery QR sharing | General-gallery and event-folder QR downloads plus a general-gallery QR/link in invitation emails; shareable across guests, not a personal RSVP credential |
| Livestream | Proposed: one wedding-wide YouTube stream; actual link and embed availability required |
| Event removal behavior | Cancellation/archive behavior to be settled in screen design |
| Recovery and retention | Manual admin photo removal with no expiry; separate photo backups deferred. Weekly development database backups, changing to daily before live use; runner, retention, and restore process pending |
| Application size | Confirmed baseline: 10 guests and 10 events; photo volume and peak viewers still to be estimated |
| Technology and running costs | Architecture document records agreed stack and providers; paid plans and total operating estimate remain open |

## 11. Delivery sequence

Each step produces a concrete reviewable result before proceeding to the next. This sequence is a plan, not an instruction to start development now.

1. **Review this PRD:** Confirm proposed defaults and resolve any scope corrections.
2. **Design the system:** Review the architecture document's components, boundaries, background work, storage, logging, and deployment choices.
3. **Design the database:** Define collections, relationships, indexes, integrity rules, and record lifecycles.
4. **Design the API:** Define operations, schemas, permissions, errors, idempotency, uploads, and callbacks.
5. **Design screens and journeys:** Review the floral website, management layout, and guest flows against the agreed contracts.
6. **Build the foundation:** Staff sign-up, verification, login, password recovery, role assignment, wedding setup, events, and shared website.
7. **Build the guest flow:** Individual guests with required email, event assignments, invitation email delivery, RSVPs, dashboard, and manual/scheduled email reminders.
8. **Build supporting features:** Expenses, organizer management, and sample planner discovery.
9. **Build shared experiences:** Event photo folders, guest uploads, gallery/event QR codes, invitation-email QR integration, thumbnails/previews, sharing controls, and YouTube embedding.
10. **Validate and prepare for live use:** Exercise permission boundaries and complete journeys, configure real services, replace placeholder wedding content, verify database restoration, and enable daily database backups. Photo backup remains deferred.

All included capabilities remain part of the first release even though implementation is staged.

## 12. Release acceptance checklist

- [ ] Both partners and invited organizers can sign up, verify their email, and log in with the correct access; uninvited accounts cannot access management data.
- [ ] Both partners can perform all admin actions.
- [ ] Forgot/reset password works with expiry and single-use links; old passwords and previous sessions stop working after reset.
- [ ] Organizers can manage all events, guests, and RSVPs, but cannot access expenses, send reminders, change access, or delete photos.
- [ ] Wedding and gallery links work for visitors without accounts.
- [ ] Personal invitation links reveal only the intended guest's invited events.
- [ ] Every guest has a required valid email; staff can send individual or selected-recipient invitation emails and review truthful results without duplicate sends.
- [ ] Invitation emails contain the recipient's own invitation link plus a usable gallery link and QR code, with no other guest's personal information.
- [ ] Separate event RSVPs persist and produce correct per-event and unique-guest counts.
- [ ] Admin-triggered reminder emails reach controlled test recipients, with accurate outcomes and duplicate-send protection.
- [ ] Daily scheduled checks send one reminder seven days before each event's RSVP deadline only to pending guests, with duplicate-run protection and admin controls.
- [ ] Expenses calculate correctly and remain admin-only.
- [ ] Planner search works with clearly identified sample data.
- [ ] General-gallery and event-folder QR codes scan successfully, open the intended destination without login, and become unusable after their access link is revoked.
- [ ] Multi-image uploads are stored in the selected event folder, appear immediately on another device, and report per-file failures; only admins can delete photos.
- [ ] Downloaded originals match uploaded file contents, and gallery-link holders can download without login. Preview processing never modifies originals.
- [ ] Photos do not automatically expire; manual deletion works. Database restoration is verified; separate original-photo backup remains explicitly deferred.
- [ ] Supported image formats, the 50 MB per-file limit, the 20-file selection limit, and separate thumbnail/preview processing are verified.
- [ ] The configured YouTube stream embeds or has a clear unavailable state.
- [ ] Revoked links and revoked organizer access no longer work through direct requests.
- [ ] Core journeys work with keyboard navigation and on mobile and desktop.
- [ ] Save, upload, email, and loading failures give truthful, recoverable feedback.
- [ ] Real wedding content, sender configuration, admin provisioning, storage limits, and recovery arrangements are ready before live use.

## 13. Scope change rule

New requests should be recorded as a scope change with their effect on screens, permissions, data, and delivery order. They should not silently enter the first release. In particular, restoring a budget tracker or task planner, adding live planner APIs, or introducing guest accounts requires an explicit scope decision.

## 14. Revision history

| Version | Date | Changes |
| --- | --- | --- |
| 1.0 | 18 September 2026 | Initial PRD based on the agreed single-wedding scope |
| 1.1 | 18 September 2026 | Added gallery/event-folder QR sharing, explicit staff sign-up and forgot/reset password flows, mandatory guest email and invitation email delivery, and folder-specific multi-image uploads. Updated permissions, screens, workflows, data model, dependencies, and release checks. Invite-only staff sign-up remains a proposed access rule for review. |
| 1.2 | 21 September 2026 | Confirmed invitation-only staff access; Next.js, Node.js, TypeScript, modular monolith, and MongoDB cluster; planning baseline of 10 guests and 10 events; untouched originals with separate previews; original downloads for gallery-link holders; manual admin photo removal without automatic expiry. Moved system design before detailed screen design and recorded unresolved provider, capacity, recovery, and cost decisions. |
| 1.3 | 21 September 2026 | Aligned with system architecture: Zod, Vercel, Atlas Free, R2, Auth.js, Resend, Inngest, seven-day scheduled RSVP reminders, configurable email batching, accepted image formats and limits, thumbnails/previews, weekly development and daily live database backups, deferred photo backups, basic logs, and separate environments. Explicitly separated database, API, and UI/UX design stages. |
