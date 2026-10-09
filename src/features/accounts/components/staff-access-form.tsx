"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { signupFormSchema, signInFormSchema } from "../schemas";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

type FieldProps = {
  name: string;
  label: string;
  type?: string;
  autoComplete: string;
  error?: string;
  disabled: boolean;
};

function AccessField({
  name,
  label,
  type = "text",
  autoComplete,
  error,
  disabled,
}: FieldProps) {
  const [visible, setVisible] = useState(false);
  const password = type === "password";
  const id = `staff-${name}`;
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-[11px] font-semibold tracking-widest text-primary uppercase"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={password && visible ? "text" : type}
          autoComplete={autoComplete}
          disabled={disabled}
          required
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`min-h-12 w-full rounded-sm border bg-panel-light px-4 py-3 text-sm text-primary focus:bg-white ${password ? "pr-20" : ""} ${error ? "border-red-700" : "border-transparent"}`}
        />
        {password && (
          <button
            type="button"
            disabled={disabled}
            aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
            aria-pressed={visible}
            onClick={() => setVisible(!visible)}
            className="absolute top-0 right-1 min-h-12 px-3 text-xs text-secondary hover:text-primary"
          >
            {visible ? "Hide" : "Show"}
          </button>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-2 text-xs leading-5 text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}

export function StaffAccessForm({
  mode,
  available = false,
}: {
  mode: "login" | "signup";
  available?: boolean;
}) {
  const router = useRouter();
  const signup = mode === "signup";
  const enabled = signup || available;
  const ready = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");

  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const result = (signup ? signupFormSchema : signInFormSchema).safeParse(
      Object.fromEntries(new FormData(form)),
    );
    setNotice("");
    if (!result.success) {
      const next: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const name = String(issue.path[0]);
        next[name] ??= issue.message;
      }
      setErrors(next);
      const field = form.elements.namedItem(Object.keys(next)[0]);
      if (field instanceof HTMLInputElement) field.focus();
      return;
    }
    setErrors({});
    if (!enabled) {
      setNotice(
        "Account access is awaiting configuration. Please try again later.",
      );
      return;
    }
    setBusy(true);
    try {
      if (signup) {
        const response = await fetch("/api/accounts/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result.data),
        });
        const body = await response.json();
        setNotice(body.message ?? "Signup could not be completed.");
        if (response.ok) form.reset();
      } else {
        const response = await signIn("credentials", {
          ...result.data,
          redirect: false,
          callbackUrl: "/dashboard",
        });
        if (response?.ok && !response.error) {
          router.push("/dashboard");
          router.refresh();
        } else
          setNotice(
            "Email or password is incorrect, or staff access is not active.",
          );
      }
    } catch {
      setNotice(
        "Account service is temporarily unavailable. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="access-title" className="mx-auto max-w-[430px]">
      <div className="rounded-xl bg-white p-6 shadow-md sm:p-10">
        <h2 id="access-title" className="font-serif text-2xl text-primary">
          {signup ? "Create your admin account" : "Welcome back"}
        </h2>
        <p className="mt-2 text-[13px] leading-5 text-muted">
          {signup
            ? "Anyone can sign up. Every new account receives admin access."
            : "Sign in to your wedding workspace."}
        </p>
        <p className="my-6 rounded-sm bg-panel px-4 py-3 text-xs leading-5 text-secondary">
          {enabled
            ? signup
              ? "Passwords must be 15–128 characters."
              : "Use your email address and password."
            : "Sign-in is awaiting server configuration."}
        </p>
        <form onSubmit={submit} method="post" noValidate className="space-y-5">
          <fieldset disabled={!ready || busy || !enabled} className="space-y-5">
            <legend className="sr-only">
              {signup ? "Signup details" : "Sign-in details"}
            </legend>
            {signup && (
              <AccessField
                name="name"
                label="Full name"
                autoComplete="name"
                error={errors.name}
                disabled={!ready || busy || !enabled}
              />
            )}
            <AccessField
              name="email"
              label="Email address"
              type="email"
              autoComplete={signup ? "email" : "username"}
              error={errors.email}
              disabled={!ready || busy || !enabled}
            />
            <AccessField
              name="password"
              label="Password"
              type="password"
              autoComplete={signup ? "new-password" : "current-password"}
              error={errors.password}
              disabled={!ready || busy || !enabled}
            />
            {signup && (
              <AccessField
                name="confirmPassword"
                label="Confirm password"
                type="password"
                autoComplete="new-password"
                error={errors.confirmPassword}
                disabled={!ready || busy || !enabled}
              />
            )}
            {!signup && (
              <p className="text-right text-xs text-secondary">
                Password recovery is coming soon.
              </p>
            )}
            <button
              type="submit"
              disabled={!ready || busy || !enabled}
              className="min-h-12 w-full rounded-sm bg-primary px-6 py-3 text-[11px] font-semibold tracking-widest text-white uppercase hover:bg-wine disabled:cursor-not-allowed"
            >
              {busy ? "Please wait…" : signup ? "Create account" : "Sign in"}
            </button>
          </fieldset>
          <p
            role="status"
            aria-live="polite"
            className="text-sm leading-6 text-secondary"
          >
            {notice}
          </p>
        </form>
        <p className="mt-6 text-center text-[13px] leading-5 text-muted">
          {signup ? "Already have an account? " : "Need an account? "}
          <Link
            href={signup ? "/login" : "/signup"}
            className="underline underline-offset-4 hover:text-primary"
          >
            {signup ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </div>
      <p className="mx-4 mt-6 text-center text-[13px] leading-5 text-muted">
        Here as a guest? Open your invitation or gallery link—no account needed.
      </p>
    </section>
  );
}
