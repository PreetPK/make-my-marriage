import { notFound } from "next/navigation";
import { requireStaff } from "@/server/auth/authorization";
import { getEvent, EventError } from "@/features/events/server/service";
import { EventForm } from "@/features/events/components/event-form";
export const metadata = { title: "Edit event | Make My Marriage" };
export default async function EditEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const staff = await requireStaff();
  const { eventId } = await params;
  if (!/^[a-f0-9]{24}$/i.test(eventId)) notFound();
  const event = await getEvent(staff, eventId).catch((error) => {
    if (error instanceof EventError && error.status === 404) notFound();
    throw error;
  });
  return <EventForm initial={event} edit={event} />;
}
