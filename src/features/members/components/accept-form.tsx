"use client";
import { useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import Link from "next/link";
import { acceptInvitationSchema } from "../schemas";
const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
export function AcceptForm({
  token,
  email,
  role,
}: {
  token: string;
  email: string;
  role: string;
}) {
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [showPassword, setShowPassword] = useState(false),
    [complete, setComplete] = useState(false);
  const submitting = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const parsed = acceptInvitationSchema.safeParse({
      ...Object.fromEntries(new FormData(form)),
      token,
      email,
    });
    setMessage("");
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues)
        next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      const field = form.elements.namedItem(Object.keys(next)[0]);
      if (field instanceof HTMLInputElement) field.focus();
      return;
    }
    setErrors({});
    submitting.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/accounts/accept-invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = await response.json();
      setMessage(body.message ?? "Invitation could not be accepted.");
      if (response.ok) {
        setComplete(true);
        form.reset();
        window.history.replaceState(null, "", "/accept-invitation");
      }
    } catch {
      setMessage(
        "The result was not confirmed. Try signing in if you already submitted; otherwise retry with these details.",
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="rounded-xl bg-white p-8 shadow-md">
      <h2 className="font-serif text-2xl text-primary">
        {complete ? "You're ready to join" : "Join your wedding workspace"}
      </h2>
      <p className="mt-3 text-sm leading-6 text-secondary">
        {email} · {role}
      </p>
      {!complete && (
        <form
          method="post"
          onSubmit={submit}
          noValidate
          className="mt-6 space-y-5"
        >
          <fieldset disabled={!ready || busy} className="space-y-5">
            <legend className="sr-only">Invitation account details</legend>
            {[
              {
                name: "name",
                label: "Full name",
                type: "text",
                autoComplete: "name",
              },
              {
                name: "password",
                label: "Password",
                type: showPassword ? "text" : "password",
                autoComplete: "new-password",
              },
              {
                name: "confirmPassword",
                label: "Confirm password",
                type: showPassword ? "text" : "password",
                autoComplete: "new-password",
              },
            ].map((field) => (
              <div key={field.name}>
                <label htmlFor={field.name} className="mb-2 block text-sm">
                  {field.label}
                </label>
                <input
                  {...field}
                  id={field.name}
                  maxLength={field.name === "name" ? 200 : 512}
                  aria-invalid={Boolean(errors[field.name])}
                  aria-describedby={
                    errors[field.name] ? `${field.name}-error` : undefined
                  }
                  className="min-h-12 w-full border border-bronze/30 px-3 focus:outline-primary"
                />
                {errors[field.name] && (
                  <p
                    id={`${field.name}-error`}
                    className="mt-2 text-xs text-red-800"
                  >
                    {errors[field.name]}
                  </p>
                )}
              </div>
            ))}
            <button
              type="button"
              aria-pressed={showPassword}
              onClick={() => setShowPassword(!showPassword)}
              className="min-h-11 text-xs underline"
            >
              {showPassword ? "Hide" : "Show"} passwords
            </button>
            <p className="text-xs leading-6 text-secondary">
              Use 15–128 characters. Your invitation determines your access. You
              will join the existing wedding without repeating setup.
            </p>
            <button
              disabled={!ready || busy}
              className="min-h-12 w-full bg-primary px-5 text-sm text-white"
            >
              {busy ? "Creating account…" : "Accept invitation"}
            </button>
          </fieldset>
        </form>
      )}
      <p role="status" className="mt-5 text-sm leading-6 text-secondary">
        {message}
      </p>
      <Link
        href="/login"
        className="mt-5 inline-flex min-h-11 items-center text-sm underline"
      >
        {complete ? "Sign in to your workspace →" : "Already accepted? Sign in"}
      </Link>
    </section>
  );
}
