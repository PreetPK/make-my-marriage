"use client";
import { useState } from "react";
import { signOut } from "next-auth/react";
export function SignOutButton({
  variant = "solid",
}: {
  variant?: "solid" | "quiet";
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await signOut({ redirect: false, callbackUrl: "/login" });
      if (!result?.url) throw new Error("Sign-out failed");
      // Replace the protected page and discard its in-memory router cache.
      window.location.replace("/login");
    } catch {
      setError("Sign-out could not be completed. Please try again.");
      setBusy(false);
    }
  }
  return (
    <div>
      <button
        disabled={busy}
        className={`min-h-11 rounded-sm px-5 py-3 text-sm disabled:cursor-not-allowed ${variant === "quiet" ? "text-secondary hover:text-primary" : "bg-primary text-white"}`}
        onClick={() => void logout()}
      >
        {busy ? "Signing out…" : "Sign out"}
      </button>
      {error && (
        <p role="status" className="mt-2 text-sm text-secondary">
          {error}
        </p>
      )}
    </div>
  );
}
