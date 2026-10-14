export function EventsLoading() {
  return (
    <div
      role="status"
      aria-label="Loading events"
      className="space-y-6 motion-safe:animate-pulse"
    >
      <div className="h-10 w-48 rounded bg-panel" />
      <div className="h-4 w-64 rounded bg-panel" />
      <div className="h-60 rounded border border-bronze/20 bg-panel-light" />
      <span className="sr-only">Loading events…</span>
    </div>
  );
}
