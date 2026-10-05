import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Page not found
        </h1>
        <p className="mt-4 leading-7 text-muted">
          This page is unavailable. You can return to the home page.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-sm py-2 underline underline-offset-4"
        >
          Return home
        </Link>
      </div>
    </main>
  );
}
