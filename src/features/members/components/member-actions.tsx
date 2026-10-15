"use client";
import { useRef, useState } from "react";
export function MemberActions({
  id,
  email,
  invitation,
  retryable = false,
}: {
  id: string;
  email: string;
  invitation: boolean;
  retryable?: boolean;
}) {
  const [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const submitting = useRef(false);
  async function act(action: string) {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/members/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = await response.json();
      if (response.ok) window.location.reload();
      else setMessage(body.message ?? "Action could not be completed.");
    } catch {
      setMessage(
        "The change was not confirmed. Refresh Members to check its status before retrying.",
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="max-w-[280px] text-xs">
      <div className="flex gap-3">
        {invitation && retryable && (
          <button
            disabled={busy}
            onClick={() => act("retry")}
            className="min-h-11 border border-bronze/30 px-3 disabled:opacity-60"
          >
            Retry email
          </button>
        )}
        <button
          disabled={busy}
          onClick={() => setConfirm(true)}
          className="min-h-11 px-2 text-red-800 underline disabled:opacity-60"
        >
          {invitation ? "Cancel invitation" : "Revoke access"}
        </button>
      </div>
      {confirm && (
        <div className="mt-2 border border-bronze/30 bg-panel-light p-4">
          <p className="leading-5">
            {invitation
              ? `Cancel the invitation for ${email}? Its link will stop working.`
              : `Revoke ${email}'s organizer access? Existing sessions will lose access. Saved wedding records will remain.`}
          </p>
          <div className="mt-3 flex gap-3">
            <button
              disabled={busy}
              onClick={() => setConfirm(false)}
              className="min-h-11 border border-bronze/30 px-3"
            >
              Keep {invitation ? "invitation" : "access"}
            </button>
            <button
              disabled={busy}
              onClick={() => act(invitation ? "cancel" : "revoke")}
              className="min-h-11 bg-primary px-3 text-white"
            >
              {busy ? "Please wait…" : "Confirm"}
            </button>
          </div>
        </div>
      )}
      <p role="status" className="mt-1 leading-5 text-secondary">
        {message}
      </p>
    </div>
  );
}
