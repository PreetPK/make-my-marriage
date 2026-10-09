"use client";
import { signOut } from "next-auth/react";
export function SignOutButton() {
  return (
    <button
      className="rounded-sm bg-primary px-5 py-3 text-sm text-white"
      onClick={() => void signOut({ callbackUrl: "/login" })}
    >
      Sign out
    </button>
  );
}
