export function WeddingSettingsLoading() {
  return (
    <section aria-label="Loading wedding settings" aria-busy="true">
      <p role="status" className="text-sm text-secondary">
        Loading wedding settings…
      </p>
      <div
        aria-hidden="true"
        className="mt-6 space-y-8 motion-safe:animate-pulse"
      >
        <div className="h-10 w-64 max-w-full rounded-sm bg-panel" />
        {[0, 1, 2].map((section) => (
          <div
            key={section}
            className="space-y-5 border-t border-bronze/20 py-6"
          >
            <div className="h-6 w-40 rounded-sm bg-panel" />
            <div className="grid gap-6 md:grid-cols-2">
              <div className="h-12 rounded-sm bg-panel-light" />
              <div className="h-12 rounded-sm bg-panel-light" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
