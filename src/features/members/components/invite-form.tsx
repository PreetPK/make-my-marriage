"use client";
import { useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import Link from "next/link";
import { inviteMemberSchema } from "../schemas";
const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
export function InviteForm() {
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady);
  const [role, setRole] = useState("coowner"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const request = useRef<{ email: string; role: string; id: string } | null>(
    null,
  );
  const submitting = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget,
      email = String(new FormData(form).get("email") ?? "").trim();
    if (
      !request.current ||
      request.current.email !== email ||
      request.current.role !== role
    )
      request.current = { email, role, id: crypto.randomUUID() };
    const parsed = inviteMemberSchema.safeParse({
      email,
      role,
      clientRequestId: request.current.id,
    });
    if (!parsed.success) {
      setMessage(parsed.error.issues[0].message);
      form.querySelector("input")?.focus();
      return;
    }
    submitting.current = true;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = await response.json();
      if (response.ok) window.location.replace("/members");
      else setMessage(body.message ?? "Invitation could not be sent.");
    } catch {
      setMessage(
        "Sending was not confirmed. Keep these details and retry, or check Members before starting a new invitation.",
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="max-w-[720px]">
      <Link
        href="/members"
        className="inline-flex min-h-11 items-center text-sm text-secondary underline"
      >
        ← Back to Members
      </Link>
      <h1 className="mt-5 font-serif text-3xl text-primary">Invite a member</h1>
      <p className="mt-3 text-sm leading-6 text-secondary">
        Plan together with your partner or invite someone to help organize your
        wedding.
      </p>
      <form
        method="post"
        onSubmit={submit}
        noValidate
        className="mt-8 border border-bronze/20 bg-white p-8"
      >
        <fieldset disabled={!ready || busy} className="space-y-6">
          <legend className="sr-only">Member invitation</legend>
          <div>
            <label htmlFor="member-email" className="mb-2 block text-sm">
              Email address
            </label>
            <input
              required
              id="member-email"
              name="email"
              type="email"
              maxLength={254}
              autoComplete="email"
              className="min-h-12 w-full border border-bronze/30 px-3 focus:outline-primary"
            />
          </div>
          <div>
            <label htmlFor="member-role" className="mb-2 block text-sm">
              Invite as
            </label>
            <select
              id="member-role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className="min-h-12 w-full border border-bronze/30 bg-white px-3 focus:outline-primary"
            >
              <option value="coowner">Co-owner</option>
              <option value="organizer">Organizer</option>
            </select>
          </div>
          <p className="border-l-2 border-bronze/40 bg-panel-light p-4 text-sm leading-6 text-secondary">
            {role === "coowner"
              ? "A co-owner has admin access, including Wedding Settings and member invitations, for this wedding."
              : "An organizer can manage events. They cannot manage members or Wedding Settings. More organizer tools will arrive with their features."}
          </p>
          <p className="text-xs leading-6 text-secondary">
            The invitation expires after 48 hours and can be accepted once. The
            recipient joins this wedding and does not repeat onboarding. Each
            account can belong to one wedding.
          </p>
          <div className="flex justify-end gap-4">
            <Link
              href="/members"
              className="inline-flex min-h-11 items-center border border-bronze/30 px-5"
            >
              Cancel
            </Link>
            <button
              disabled={!ready || busy}
              className="min-h-11 bg-primary px-5 text-sm text-white disabled:opacity-60"
            >
              {busy ? "Sending…" : "Send invitation"}
            </button>
          </div>
        </fieldset>
        <p role="status" className="mt-4 text-sm leading-6 text-secondary">
          {message}
        </p>
      </form>
    </section>
  );
}
