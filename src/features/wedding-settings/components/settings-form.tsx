"use client";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import type {
  OnboardingValues,
  onboardingChoices,
} from "@/features/wedding-onboarding/schemas";
import {
  settingsClientSchema,
  settingsValues,
  type WeddingSettingsState,
} from "../schemas";
const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
type Field = Exclude<
  keyof OnboardingValues,
  "dateUndecided" | "venueUndecided"
>;

export function WeddingSettingsForm({
  initial,
  choices,
}: {
  initial: WeddingSettingsState;
  choices: ReturnType<typeof onboardingChoices>;
}) {
  const ready = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const [saved, setSaved] = useState(initial);
  const [values, setValues] = useState(initial.values);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const leaving = useRef(false);
  const [confirmation, setConfirmation] = useState<{
    kind: "discard" | "reload" | "navigate";
    href?: string;
  } | null>(null);
  const dirty = JSON.stringify(values) !== JSON.stringify(saved.values);
  const disabled = !ready || busy || Boolean(confirmation);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (leaving.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const navigate = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download")
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      setConfirmation({ kind: "navigate", href: anchor.href });
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", navigate, true);
    };
  }, [dirty]);
  function change(key: keyof OnboardingValues, value: string | boolean) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      if (key === "dateUndecided") delete next.weddingDate;
      if (key === "venueUndecided") {
        delete next.venueName;
        delete next.venueAddress;
      }
      return next;
    });
    if (!conflict) {
      setMessage("");
      setSuccess(false);
    }
  }
  function adopt(state: WeddingSettingsState) {
    setSaved(state);
    setValues(state.values);
    setErrors({});
    setConflict(false);
  }
  function focusErrors(fields: Record<string, string>) {
    const first = Object.keys(fields)[0];
    if (first)
      requestAnimationFrame(() =>
        document.getElementById(`settings-${first}`)?.focus(),
      );
  }
  useEffect(() => {
    if (!confirmation) return;
    document.getElementById("settings-confirm-cancel")?.focus();
    const cancel = (event: KeyboardEvent) => {
      if (event.key === "Escape") setConfirmation(null);
    };
    document.addEventListener("keydown", cancel);
    return () => document.removeEventListener("keydown", cancel);
  }, [confirmation]);
  async function loadLatest() {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/wedding/settings", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }
      if (response.status === 403) {
        window.location.replace("/dashboard");
        return;
      }
      const result = await response.json();
      if (!response.ok || !result.state) throw new Error();
      adopt(result.state);
      setSuccess(true);
      setMessage("Latest saved details loaded.");
    } catch {
      setSuccess(false);
      setMessage(
        "We couldn’t load the latest details. Your entries are still here. Please try again.",
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || conflict || !dirty || !ready) return;
    const parsed = settingsClientSchema({
      ...choices,
      timeZones: Array.from(
        new Set([...choices.timeZones, saved.values.timeZone]),
      ),
    }).safeParse(settingsValues(values));
    setSuccess(false);
    setMessage("");
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[1];
        if (typeof key === "string" && !fields[key])
          fields[key] = issue.message;
      }
      setErrors(fields);
      focusErrors(fields);
      return;
    }
    setErrors({});
    saving.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/wedding/settings", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedRevision: saved.revision,
          values: settingsValues(values),
        }),
      });
      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }
      if (response.status === 403) {
        window.location.replace("/dashboard");
        return;
      }
      const result = await response.json();
      if (!response.ok || !result.state) {
        setMessage(
          result.message ||
            "We couldn’t save your changes. Your entries are still here. Please try again.",
        );
        setErrors(result.fields ?? {});
        focusErrors(result.fields ?? {});
        setConflict(response.status === 409);
        return;
      }
      adopt(result.state);
      setSuccess(true);
      setMessage("Your wedding settings have been saved.");
    } catch {
      setMessage(
        "We couldn’t save your changes. Your entries are still here. Please try again.",
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  function inputClass(key: Field) {
    return `min-h-12 w-full min-w-0 rounded-sm border bg-white/60 px-4 py-3 text-base text-primary disabled:cursor-not-allowed disabled:opacity-60 ${errors[key] ? "border-red-800" : "border-bronze/35"}`;
  }
  function label(key: Field, text: string, required = false) {
    return (
      <label
        htmlFor={`settings-${key}`}
        className="mb-2 flex flex-wrap justify-between gap-2 text-sm text-primary"
      >
        <span>{text}</span>
        <span className="text-xs text-secondary">
          {required ? "Required" : "Optional"}
        </span>
      </label>
    );
  }
  function fieldError(key: Field) {
    return errors[key] ? (
      <p id={`settings-${key}-error`} className="mt-2 text-sm text-red-800">
        {errors[key]}
      </p>
    ) : null;
  }
  function textField(
    key: Field,
    text: string,
    required = false,
    multiline = false,
  ) {
    const props = {
      id: `settings-${key}`,
      name: key,
      value: values[key],
      onChange: (
        event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      ) => change(key, event.target.value),
      disabled:
        disabled ||
        (key === "weddingDate" && values.dateUndecided) ||
        (key.startsWith("venue") && values.venueUndecided),
      required,
      maxLength:
        key === "venueAddress" ? 1000 : key === "weddingDate" ? 32 : 200,
      autoComplete: "off",
      "aria-invalid": Boolean(errors[key]),
      "aria-describedby":
        [
          key === "weddingDate" ? "settings-date-help" : "",
          errors[key] ? `settings-${key}-error` : "",
        ]
          .filter(Boolean)
          .join(" ") || undefined,
      className: inputClass(key),
    };
    return (
      <div>
        {label(key, text, required)}
        {multiline ? (
          <textarea {...props} rows={2} />
        ) : (
          <input
            {...props}
            type="text"
            placeholder={key === "weddingDate" ? "DD / MM / YYYY" : undefined}
          />
        )}
        {fieldError(key)}
      </div>
    );
  }
  function select(key: "timeZone" | "currency", text: string, helper: string) {
    const locked = saved.locks[key];
    return (
      <div>
        {label(key, text, true)}
        <select
          id={`settings-${key}`}
          name={key}
          value={values[key]}
          disabled={disabled || locked}
          required
          onChange={(event) => change(key, event.target.value)}
          aria-invalid={Boolean(errors[key])}
          aria-describedby={`settings-${key}-help${errors[key] ? ` settings-${key}-error` : ""}`}
          className={inputClass(key)}
        >
          <option value="">
            Select {key === "timeZone" ? "a time zone" : "a currency"}
          </option>
          {key === "timeZone"
            ? Array.from(
                new Set([...choices.timeZones, saved.values.timeZone]),
              ).map((zone) => (
                <option key={zone} value={zone}>
                  {zone.replaceAll("_", " ")}
                </option>
              ))
            : choices.currencies.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.label}
                </option>
              ))}
        </select>
        {fieldError(key)}
        <p
          id={`settings-${key}-help`}
          className="mt-2 text-sm leading-5 text-secondary"
        >
          {locked
            ? key === "timeZone"
              ? "Locked because events already use this time zone."
              : "Locked because expenses already use this currency."
            : helper}
        </p>
      </div>
    );
  }
  function undecided(key: "dateUndecided" | "venueUndecided", text: string) {
    return (
      <label className="flex min-h-11 items-center gap-3 text-sm text-secondary">
        <input
          type="checkbox"
          checked={values[key]}
          disabled={disabled}
          onChange={(event) => change(key, event.target.checked)}
          className="size-4 shrink-0 accent-primary"
        />
        {text}
      </label>
    );
  }
  return (
    <section aria-labelledby="settings-title">
      <h1
        id="settings-title"
        className="font-serif text-3xl text-primary md:text-[40px]"
      >
        Wedding Settings
      </h1>
      <p className="mt-3 text-base text-secondary">
        Edit the details shared across your wedding workspace.
      </p>
      <p className="mt-6 rounded-sm border border-bronze/20 bg-panel-light px-4 py-3 text-sm leading-6 text-secondary">
        All admins share these settings. Saving does not publish your wedding
        website.
      </p>
      {confirmation && (
        <div
          role="alertdialog"
          aria-labelledby="settings-confirm-title"
          aria-describedby="settings-confirm-description"
          className="mt-6 rounded-sm border border-bronze/35 bg-panel-light p-5"
        >
          <h2
            id="settings-confirm-title"
            className="font-serif text-xl text-primary"
          >
            {confirmation.kind === "discard"
              ? "Discard changes?"
              : confirmation.kind === "reload"
                ? "Load latest saved details?"
                : "Leave this page?"}
          </h2>
          <p
            id="settings-confirm-description"
            className="mt-2 text-sm text-secondary"
          >
            {confirmation.kind === "reload"
              ? "This replaces your unsaved entries with the shared saved details."
              : "Your unsaved changes will be lost."}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              id="settings-confirm-cancel"
              type="button"
              onClick={() => setConfirmation(null)}
              className="min-h-11 rounded-sm border border-bronze/35 px-4 py-2 text-sm text-primary"
            >
              Keep editing
            </button>
            <button
              type="button"
              className="min-h-11 rounded-sm bg-primary px-4 py-2 text-sm text-white"
              onClick={() => {
                const action = confirmation;
                setConfirmation(null);
                if (action.kind === "reload") {
                  void loadLatest();
                  return;
                }
                if (action.kind === "navigate" && action.href) {
                  leaving.current = true;
                  window.location.assign(action.href);
                  return;
                }
                setValues(saved.values);
                setErrors({});
                if (!conflict) {
                  setMessage("");
                  setSuccess(false);
                }
              }}
            >
              {confirmation.kind === "discard"
                ? "Confirm discard"
                : confirmation.kind === "reload"
                  ? "Load saved details"
                  : "Leave page"}
            </button>
          </div>
        </div>
      )}
      <form noValidate onSubmit={submit} aria-busy={busy} className="mt-8">
        {Object.keys(errors).length > 0 && (
          <p
            role="alert"
            className="mb-6 rounded-sm border border-red-800/30 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            Please check the highlighted details.
          </p>
        )}
        {message && (
          <div
            role={success ? "status" : "alert"}
            className={`mb-6 rounded-sm border px-4 py-3 text-sm leading-6 ${success ? "border-bronze/25 bg-panel-light text-primary" : "border-red-800/30 bg-red-50 text-red-800"}`}
          >
            <p>{message}</p>
            {conflict && (
              <>
                <p>
                  Your entries are still here. Loading the saved details
                  replaces this form.
                </p>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setConfirmation({ kind: "reload" })}
                  className="mt-2 min-h-11 underline underline-offset-4 disabled:opacity-60"
                >
                  Load latest saved details
                </button>
              </>
            )}
          </div>
        )}
        <section
          aria-labelledby="couple-heading"
          className="border-t border-bronze/20 py-8"
        >
          <h2 id="couple-heading" className="font-serif text-2xl text-primary">
            Couple details
          </h2>
          <p className="mt-2 text-sm text-secondary">
            The names and date for your wedding workspace.
          </p>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {textField("brideName", "Bride’s name", true)}
            {textField("groomName", "Groom’s name", true)}
            <div>
              {textField("weddingDate", "Wedding date")}
              <p
                id="settings-date-help"
                className="mt-2 text-sm text-secondary"
              >
                Format: DD / MM / YYYY
              </p>
            </div>
            <div className="md:pt-7">
              {undecided("dateUndecided", "We haven’t decided the date yet")}
            </div>
          </div>
        </section>
        <section
          aria-labelledby="venue-heading"
          className="border-t border-bronze/20 py-8"
        >
          <h2 id="venue-heading" className="font-serif text-2xl text-primary">
            Venue
          </h2>
          <p className="mt-2 text-sm text-secondary">
            Your primary celebration venue. These details are optional.
          </p>
          <div className="mt-6 space-y-5">
            {textField("venueName", "Venue name")}
            {textField("venueAddress", "Venue address", false, true)}
            {undecided("venueUndecided", "We haven’t chosen a venue yet")}
          </div>
        </section>
        <section
          aria-labelledby="preferences-heading"
          className="border-t border-bronze/20 py-8"
        >
          <h2
            id="preferences-heading"
            className="font-serif text-2xl text-primary"
          >
            Wedding preferences
          </h2>
          <p className="mt-2 text-sm text-secondary">
            The time zone and currency for this wedding workspace.
          </p>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {select(
              "timeZone",
              "Wedding time zone",
              "Events and reminders will follow this setting.",
            )}
            {select(
              "currency",
              "Wedding currency",
              "Expenses will use this currency.",
            )}
          </div>
        </section>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-bronze/20 pt-6">
          <p role="status" className="text-sm text-secondary">
            {busy
              ? "Saving your changes…"
              : dirty
                ? "Unsaved changes will be lost if you leave this page."
                : "No unsaved changes."}
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={disabled || !dirty}
              onClick={() => setConfirmation({ kind: "discard" })}
              className="min-h-12 rounded-sm border border-bronze/40 px-5 py-3 text-sm text-secondary disabled:opacity-50"
            >
              Discard changes
            </button>
            <button
              type="submit"
              disabled={disabled || !dirty || conflict}
              className="min-h-12 rounded-sm bg-primary px-6 py-3 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy
                ? "Saving…"
                : message && !success && !conflict
                  ? "Try again"
                  : "Save changes"}
              <span aria-hidden="true" className="ml-3">
                →
              </span>
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
