# Make My Marriage

## API Design — Plain-language Guide

**Version:** 1.1  
**Date:** 24 September 2026  
**Status:** Proposed contracts for review; no endpoints implemented  
**Scale:** One wedding, 1,000 events, and 1,000 unique guests  
**Next stage:** UI/UX design after API review

An API is how a screen asks the server to load or change information. For example, the guest form asks the server to save an RSVP, and the server checks permission before saving it in MongoDB.

This guide explains the main actions and their results. The [API Technical Reference](Make-My-Marriage-API-Technical-Reference.md) contains the complete route list, field rules, error responses, and background-service contracts. It follows the [database design](Make-My-Marriage-Database-Design.md), [PRD](Make-My-Marriage-PRD.md), and [architecture](Make-My-Marriage-System-Architecture.md).

**Looking for payloads?** Open [all 76 endpoints with full request and response examples](Make-My-Marriage-API-Technical-Reference.md#13-complete-endpoint-examples). Each endpoint has headers, JSON payload or query parameters, a success response, and an error example. [Auth.js, webhooks, background jobs, and storage requests](Make-My-Marriage-API-Technical-Reference.md#14-library-and-provider-interfaces) are covered separately.

### 1. How to read an API address

Our application routes start with `/api/v1`. The `v1` identifies the first version of the contract.

| Method | Meaning | Example |
| --- | --- | --- |
| GET | Read information | Load the event list |
| POST | Create something or request an action | Create an event or send invitations |
| PATCH | Change selected details | Update a venue or RSVP |
| DELETE | Remove or revoke something | Remove an expense or revoke a link |

`{eventId}` means the ID of a particular event. These are proposed addresses for our app, not links to a running service.

### 2. Who can use each part?

| Access | What it allows |
| --- | --- |
| Admin login | Full management, including expenses, staff access, manual reminders, reminder settings, and photo deletion |
| Organizer login | Manage events, guests, invitations, and RSVPs; send invitation emails; use the gallery and planner directory |
| Personal invitation link | View one guest's assigned events and update that guest's RSVPs |
| Wedding website link | View shared website content, visible events, and the configured YouTube stream |
| Gallery link or QR code | Browse event albums, upload photos, and download originals |

The server checks these rules on every request. A gallery link cannot change RSVPs. Organizers cannot trigger manual reminders or read expenses. Guests do not create accounts.

Opening a sharing link gives the browser temporary access to that part of the app without a login form. Revoking the original link also stops that browser access. A forwarded valid link gives its holder the same access as the original recipient.

### 3. Login, sign-up, and recovery

| Action | What happens |
| --- | --- |
| Staff sign-up | A preauthorized person uses their staff invitation, sets a password, and verifies their email |
| Login | Auth.js checks credentials and starts a staff session |
| Forgot password | The server gives a neutral confirmation and sends a reset email only to an eligible account |
| Reset password | A valid, unused reset link changes the password and invalidates earlier sessions |
| Logout | The current staff session ends |
| Invite/revoke organizer | An admin grants or removes organizer access |

Login/logout use Auth.js's own integration. Our account endpoints supply the invitation, verification, and recovery flows. Users cannot choose their own role during sign-up.

### 4. Management actions

The routes below omit the common `/api/v1` prefix.

| Area | Main routes | Who can use them? |
| --- | --- | --- |
| Dashboard | `GET /dashboard`, `GET /dashboard/events` | Admin and organizer; expense information only for admin |
| Wedding website/settings | `GET /wedding`, `PATCH /wedding` | Admin |
| Events | `GET /events`, `POST /events`, `PATCH /events/{eventId}` | Admin and organizer |
| Guests | `GET /guests`, `POST /guests`, `PATCH /guests/{guestId}` | Admin and organizer |
| Assign guests to events | `POST /assignment-operations` | Admin and organizer |
| Review event guest list | `GET /events/{eventId}/invitations` | Admin and organizer |
| Record an RSVP for a guest | `PATCH /invitations/{invitationId}/rsvp` | Admin and organizer |
| Invitation emails | `POST /email-previews`, `POST /email-operations` with kind `invitation` | Admin and organizer |
| Manual reminder emails | The same preview/send routes with kind `manual_reminder` | Admin only |
| Automatic-reminder settings | `PATCH /reminder-settings`, `PATCH /events/{eventId}/reminder-settings` | Admin only |
| Expenses | `GET /expenses`, `POST /expenses`, `PATCH /expenses/{expenseId}`, `DELETE /expenses/{expenseId}` | Admin only |
| Staff access | `GET /staff`, `POST /staff/invitations`, `DELETE /staff/{userId}/access` | Admin only |
| Sample planner search | `GET /planners?area=Jaipur` | Admin and organizer |

Cancelling an event or removing a guest preserves historical records. It does not silently delete photos or send email. The full reference includes these lifecycle routes, sharing controls, and read/detail endpoints.

### 5. Guest invitation and RSVP example

Suppose Aarav is invited to the ceremony and reception:

1. He opens his personal invitation link.
2. The page loads his event list with `GET /guest/invitation/events`.
3. He chooses “Attending” for the ceremony.
4. The page calls `PATCH /guest/invitations/{invitationId}/rsvp`.
5. The server verifies that the invitation belongs to this link and saves the answer.
6. The page shows “Response saved.” His reception response stays unchanged.

An example request body is:

```json
{
  "status": "attending",
  "expectedRevision": 3
}
```

The revision is a record's edit number. If someone else changed the response after the page loaded, the server asks the page to refresh rather than silently overwriting the newer answer.

The current proposal allows guests to change responses after the RSVP deadline while the event and invitation remain active. The deadline controls reminder timing; automatic response locking is not assumed.

### 6. Assigning and emailing 1,000 guests

Large actions return a tracking ID quickly and continue in the background. The page can show progress without keeping one request open for the entire job.

| Action | Immediate response | How progress is checked |
| --- | --- | --- |
| Assign selected guests to selected events | Assignment operation ID | `GET /assignment-operations/{operationId}` |
| Send invitations or manual reminders | Email operation ID | `GET /email-operations/{operationId}` |
| Finish an uploaded photo | Photo ID and processing state | `GET /gallery/photos/{photoId}` |

For assignments, the request contains lists of selected guest IDs and event IDs. The server processes the combinations in smaller groups. Selecting all 1,000 of each can create up to 1,000,000 assignment records; no emails are sent by that action.

For email, staff first preview the recipient count and a sample message, then explicitly send. Sending to 1,000 guests creates 1,000 personalized messages, with each guest's link covering their assigned events. A repeated click or network retry reuses the same operation rather than starting another send.

The UI distinguishes **queued**, **accepted by the email provider**, **delivered**, and **failed**. “Queued” never means “delivered.” Successful recipients are not automatically resent when failed work is retried.

### 7. Photo upload and gallery flow

| Step | Route/action | Result |
| --- | --- | --- |
| Open albums | `GET /gallery/albums` | A page of event folders |
| Open photos | `GET /gallery/albums/{eventId}/photos` | A page of thumbnails/previews |
| Select files | `POST /gallery/uploads` | A photo ID and temporary upload address for each file |
| Transfer bytes | Browser uploads directly to Cloudflare R2 | Original files reach private storage |
| Finish each upload | `POST /gallery/uploads/{photoId}/complete` | Server validates the file and prepares previews |
| Download original | `POST /gallery/photos/{photoId}/download` | Temporary download address |
| Delete photo | `DELETE /gallery/photos/{photoId}` | Admin-only removal, with retry if storage is unavailable |

Everyone with valid gallery access can browse, upload, and download originals. Only admins can delete. Original bytes stay unchanged; smaller previews are separate files.

The existing limits remain 20 selected files and 50 MB per file. Proposed technical defaults are three simultaneous uploads, 15-minute upload addresses, and five-minute download addresses. These defaults are marked for review, not already configured.

An event QR opens that album first. It still grants the agreed shared-gallery access, rather than a private event-only permission.

### 8. What happens when something fails?

| Situation | What the page should do |
| --- | --- |
| Missing guest email | Highlight the email field and keep entered details |
| Staff login expired | Ask the person to sign in again |
| Guest link revoked/invalid | Show that the link is unavailable and suggest contacting the couple |
| Unauthorized action | Explain that this account/link cannot perform it |
| Another person changed the record | Reload the latest saved version before retrying |
| Temporary email outage | Show pending/failed progress; do not claim the email was sent |
| One photo fails | Retry that file while preserving other successful uploads |
| Too many requests | Show a short wait and retry after the server's stated delay |

Lists load in pages: proposed default 50 items, maximum 100. The dashboard returns counts, not every invitation record. This applies to events, guests, personal invitation events, albums, photos, and histories.

### 9. Decisions and the next step

This design preserves the agreed features and role boundaries. The technical reference proposes exact page limits, token lifetimes, retry behavior, and upload timings. Daily reminder time, outage catch-up rules, and cancelled-album behavior still need review before implementation.

One database addition is proposed: `assignmentOperations`, which remembers the selection and progress of large guest-to-event assignments. It is internal bookkeeping, not another user-facing feature. The database documents include an addendum describing it.

After reviewing the API design, the next step is **UI/UX**: page navigation, forms, guest invitation screens, event albums, progress indicators, and error states. No application code, service setup, or deployment is part of this document.
