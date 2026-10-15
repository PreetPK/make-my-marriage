"use client";
import Link from "next/link";
export default function MembersError({ reset }: { reset: () => void }) {
  return (
    <section>
      <h1 className="font-serif text-3xl text-primary">
        Members could not be loaded
      </h1>
      <p className="mt-4 text-sm text-secondary">
        Please try again. No access changes were made by loading this page.
      </p>
      <button
        onClick={reset}
        className="mt-6 min-h-11 bg-primary px-5 text-white"
      >
        Try again
      </button>
      <Link href="/dashboard" className="ml-5 text-sm underline">
        Dashboard
      </Link>
    </section>
  );
}
