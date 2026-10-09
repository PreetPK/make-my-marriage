import { requireStaff } from "@/server/auth/authorization";
export default async function DashboardPage() {
  const staff = await requireStaff();
  return (
    <section>
      <h1 className="font-serif text-3xl">Welcome, {staff.name}</h1>
      <p className="mt-4 text-secondary">
        Your staff access is active. Wedding management tools will be added here
        as each feature is implemented.
      </p>
    </section>
  );
}
