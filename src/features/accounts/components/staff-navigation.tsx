"use client";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
function NavigationPending() {
  const { pending } = useLinkStatus();
  return pending ? (
    <span role="status" className="mt-1 block text-xs">
      Opening…
    </span>
  ) : null;
}
export function StaffNavigation({ admin }: { admin: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Workspace" className="flex gap-2 md:flex-col">
      {[
        { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
        { href: "/events", label: "Events", icon: "events" },
        ...(admin
          ? [
              {
                href: "/wedding-settings",
                label: "Wedding Settings",
                icon: "settings",
              },
              { href: "/members", label: "Members", icon: "members" },
            ]
          : []),
      ].map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={
            pathname === item.href || pathname.startsWith(item.href + "/")
              ? "page"
              : undefined
          }
          className={`flex min-h-11 items-center gap-3 rounded-sm border-l-2 px-4 py-3 text-sm ${pathname === item.href || pathname.startsWith(item.href + "/") ? "border-primary bg-panel text-primary" : "border-transparent text-secondary hover:bg-panel-light"}`}
        >
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            {item.icon === "dashboard" ? (
              <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />
            ) : item.icon === "events" ? (
              <>
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M7 2v6m10-6v6M3 11h18" />
              </>
            ) : item.icon === "members" ? (
              <>
                <circle cx="9" cy="7" r="3" />
                <path d="M3 21v-3a6 6 0 0 1 12 0v3m2-17a3 3 0 0 1 0 6m1 5a5 5 0 0 1 3 5v1" />
              </>
            ) : (
              <>
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v4m0 12v4M2 12h4m12 0h4M5 5l3 3m8 8 3 3M19 5l-3 3m-8 8-3 3" />
              </>
            )}
          </svg>
          <span className="min-w-0 flex-1">
            {item.label}
            <NavigationPending />
          </span>
        </Link>
      ))}
    </nav>
  );
}
