"use client";
export default function EventsError({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="space-y-4">
      <h1 className="font-serif text-3xl">Events couldn’t load</h1>
      <p className="text-secondary">
        Please try again. Your saved events have not been changed.
      </p>
      <button
        type="button"
        onClick={reset}
        className="min-h-11 rounded-sm bg-primary px-5 text-white"
      >
        Try again
      </button>
    </div>
  );
}
