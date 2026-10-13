import { requireStaff } from "@/server/auth/authorization";
import { getOnboarding } from "@/features/wedding-onboarding/server/service";
export default async function DashboardPage() {
  const staff = await requireStaff();
  const setup = await getOnboarding(staff);
  const details = setup.values;
  return (
    <section>
      <h1 className="font-serif text-3xl">Welcome, {staff.name}</h1>
      {setup.complete ? (
        <>
          <p className="mt-4 text-secondary">
            Your wedding workspace is ready. Your wedding website has not been
            published by completing setup.
          </p>
          <dl className="mt-8 grid gap-6 rounded-sm border border-bronze/20 bg-panel-light p-6 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-secondary">Couple</dt>
              <dd className="mt-1 font-serif text-xl">
                {details.brideName} &amp; {details.groomName}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-secondary">Wedding date</dt>
              <dd className="mt-1">
                {details.weddingDate || "Not decided yet"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-secondary">Time zone</dt>
              <dd className="mt-1 break-words">
                {details.timeZone.replaceAll("_", " ")}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-secondary">Currency</dt>
              <dd className="mt-1">{details.currency}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm text-secondary">Venue</dt>
              <dd className="mt-1 whitespace-pre-wrap break-words">
                {[details.venueName, details.venueAddress]
                  .filter(Boolean)
                  .join("\n") || "Not decided yet"}
              </dd>
            </div>
          </dl>
          <p className="mt-6 text-sm text-secondary">
            Wedding management tools will be added here as each feature is
            implemented.
          </p>
        </>
      ) : (
        <p className="mt-4 text-secondary">
          Wedding setup is in progress. An admin needs to finish setting up the
          shared workspace.
        </p>
      )}
    </section>
  );
}
