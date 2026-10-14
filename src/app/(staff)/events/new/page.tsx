import { Suspense } from "react";
import { requireStaff, type CurrentStaff } from "@/server/auth/authorization";
import { getEventContext } from "@/features/events/server/service";
import { EventsLoading } from "@/features/events/components/events-loading";
import { EventForm } from "@/features/events/components/event-form";
export const metadata = { title: "Create event | Make My Marriage" };
export default async function CreateEventPage() {
  const staff = await requireStaff();
  return (
    <Suspense fallback={<EventsLoading />}>
      <CreateContent staff={staff} />
    </Suspense>
  );
}
async function CreateContent({ staff }: { staff: CurrentStaff }) {
  return <EventForm initial={await getEventContext(staff)} />;
}
