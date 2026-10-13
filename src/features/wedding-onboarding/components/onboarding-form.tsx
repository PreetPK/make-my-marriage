"use client";
import { useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import {
  coupleDetailsSchema,
  weddingSettingsSelectionSchema,
  venueSchema,
  type OnboardingState,
  type OnboardingValues,
  type SetupStep,
  type onboardingChoices,
} from "../schemas";
import { OnboardingShell } from "./onboarding-shell";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
const titles = ["Couple details", "Wedding settings", "Venue"];
const descriptions = [
  "Start with the names you’d like displayed on your wedding website.",
  "These settings apply to the whole wedding.",
  "This is optional. Each event can have its own venue later.",
];
type Field = Exclude<
  keyof OnboardingValues,
  "dateUndecided" | "venueUndecided"
>;

export function OnboardingForm({
  initial,
  choices,
}: {
  initial: OnboardingState;
  choices: ReturnType<typeof onboardingChoices>;
}) {
  const ready = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const [step, setStep] = useState<SetupStep>(initial.step);
  const [values, setValues] = useState(initial.values);
  const [revision, setRevision] = useState(initial.revision);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const disabled = !ready || busy;
  function change(key: keyof OnboardingValues, value: string | boolean) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      if (key === "dateUndecided") delete next.weddingDate;
      return next;
    });
    // Keep revision conflicts visible until the latest shared record is loaded.
    if (!conflict) setError("");
  }
  function move(next: SetupStep) {
    setStep(next);
    setErrors({});
    if (!conflict) setError("");
    requestAnimationFrame(() =>
      document.getElementById("setup-title")?.focus(),
    );
  }
  function currentValues() {
    if (step === 1)
      return {
        brideName: values.brideName,
        groomName: values.groomName,
        weddingDate: values.weddingDate,
        dateUndecided: values.dateUndecided,
      };
    if (step === 2)
      return { timeZone: values.timeZone, currency: values.currency };
    return {
      venueName: values.venueName,
      venueAddress: values.venueAddress,
      venueUndecided: values.venueUndecided,
    };
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || conflict) return;
    setError("");
    const data = currentValues();
    const schema =
      step === 1
        ? coupleDetailsSchema
        : step === 2
          ? weddingSettingsSelectionSchema(choices)
          : venueSchema;
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues)
        if (typeof issue.path[0] === "string" && !next[issue.path[0]])
          next[issue.path[0]] = issue.message;
      setErrors(next);
      const first = Object.keys(next)[0];
      if (first)
        requestAnimationFrame(() =>
          document.getElementById(`setup-${first}`)?.focus(),
        );
      return;
    }
    setErrors({});
    saving.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/wedding/onboarding", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step,
          expectedRevision: revision,
          values: data,
        }),
      });
      const result = (await response.json()) as {
        state?: OnboardingState;
        message?: string;
        code?: string;
        fields?: Record<string, string>;
      };
      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }
      if (response.status === 403 || result.code === "SETUP_COMPLETE") {
        window.location.replace("/dashboard");
        return;
      }
      if (!response.ok || !result.state) {
        setError(
          result.message ??
            "We couldn’t save your wedding details. Please try again.",
        );
        setErrors(result.fields ?? {});
        setConflict(response.status === 409);
        return;
      }
      setRevision(result.state.revision);
      if (result.state.complete) {
        window.location.replace("/dashboard");
        return;
      }
      // Keep drafts in later steps when Back/Continue is used. Server-normalized
      // saved values become authoritative only for the step just submitted.
      if (step === 1)
        setValues((current) => ({
          ...current,
          brideName: result.state!.values.brideName,
          groomName: result.state!.values.groomName,
        }));
      move((step + 1) as SetupStep);
    } catch {
      setError(
        "We couldn’t save your wedding details. Please try again. Your entries are still here.",
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  function label(key: Field, text: string, required: boolean) {
    return (
      <label
        htmlFor={`setup-${key}`}
        className="mb-2 block text-sm text-primary"
      >
        {text}{" "}
        <span className="text-secondary">
          ({required ? "Required" : "Optional"})
        </span>
      </label>
    );
  }
  function fieldError(key: Field) {
    return errors[key] ? (
      <p id={`setup-${key}-error`} className="mt-2 text-sm text-red-800">
        {errors[key]}
      </p>
    ) : null;
  }
  function classes(key: Field) {
    return `min-h-12 w-full min-w-0 rounded-sm border bg-panel-light px-4 py-3 text-base text-primary placeholder:text-secondary disabled:cursor-not-allowed disabled:opacity-60 ${errors[key] ? "border-red-800" : "border-bronze/40"}`;
  }
  function textField(
    key: Field,
    text: string,
    placeholder: string,
    required = false,
    multiline = false,
  ) {
    const props = {
      id: `setup-${key}`,
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
      placeholder,
      "aria-invalid": Boolean(errors[key]),
      "aria-describedby":
        [
          key === "weddingDate" ? "date-help" : "",
          errors[key] ? `setup-${key}-error` : "",
        ]
          .filter(Boolean)
          .join(" ") || undefined,
      className: classes(key),
    };
    return (
      <div>
        {label(key, text, required)}
        {multiline ? (
          <textarea {...props} rows={3} />
        ) : (
          <input {...props} type="text" />
        )}
        {fieldError(key)}
      </div>
    );
  }
  function selectField(
    key: "timeZone" | "currency",
    text: string,
    helper: string,
  ) {
    return (
      <div>
        {label(key, text, true)}
        <select
          id={`setup-${key}`}
          name={key}
          value={values[key]}
          onChange={(event) => change(key, event.target.value)}
          disabled={disabled}
          required
          aria-invalid={Boolean(errors[key])}
          aria-describedby={`setup-${key}-help${errors[key] ? ` setup-${key}-error` : ""}`}
          className={classes(key)}
        >
          <option value="">
            {key === "timeZone" ? "Select a time zone" : "Select a currency"}
          </option>
          {key === "timeZone"
            ? Array.from(
                new Set([
                  ...choices.timeZones,
                  ...(values.timeZone ? [values.timeZone] : []),
                ]),
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
          id={`setup-${key}-help`}
          className="mt-2 text-sm leading-5 text-secondary"
        >
          {helper}
        </p>
      </div>
    );
  }
  return (
    <OnboardingShell step={step}>
      <section className="min-w-0" aria-labelledby="setup-title">
        <h2
          id="setup-title"
          tabIndex={-1}
          className="font-serif text-2xl text-primary md:text-3xl"
        >
          {titles[step - 1]}
        </h2>
        <p className="mt-2 text-base leading-6 text-secondary">
          {descriptions[step - 1]}
        </p>
        <form
          noValidate
          onSubmit={submit}
          aria-busy={busy}
          className="mt-6 space-y-6"
        >
          {Object.keys(errors).length > 0 && (
            <p
              role="alert"
              className="rounded-sm border border-red-800/30 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              Please check the highlighted details.
            </p>
          )}
          {error && (
            <div
              role="alert"
              className="rounded-sm border border-red-800/30 bg-red-50 px-4 py-3 text-sm leading-5 text-red-800"
            >
              <p>{error}</p>
              <p className="mt-2">Your entries are still here.</p>
              {conflict && (
                <>
                  <p className="mt-2">
                    Reloading replaces this form with the shared saved details.
                  </p>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="mt-2 min-h-11 underline underline-offset-4"
                  >
                    Load latest saved details
                  </button>
                </>
              )}
            </div>
          )}
          {busy && (
            <p
              role="status"
              className="bg-panel-light px-4 py-3 text-sm text-secondary"
            >
              Saving your wedding details…
            </p>
          )}
          {step === 1 && (
            <>
              <div className="grid gap-6 md:grid-cols-2">
                {textField(
                  "brideName",
                  "Bride’s name",
                  "Enter bride’s name",
                  true,
                )}
                {textField(
                  "groomName",
                  "Groom’s name",
                  "Enter groom’s name",
                  true,
                )}
              </div>
              <div>
                {textField("weddingDate", "Wedding date", "DD / MM / YYYY")}
                <p
                  id="date-help"
                  className="mt-2 text-sm leading-5 text-secondary"
                >
                  Use day / month / year. You can add or change this later.
                </p>
                <label className="mt-3 flex min-h-11 items-center gap-3 text-sm leading-5 text-secondary">
                  <input
                    type="checkbox"
                    checked={values.dateUndecided}
                    onChange={(event) =>
                      change("dateUndecided", event.target.checked)
                    }
                    disabled={disabled}
                    className="size-4 shrink-0 accent-primary"
                  />
                  We haven’t decided the date yet
                </label>
              </div>
              <p className="rounded-sm border border-bronze/15 bg-panel-light px-4 py-3 text-sm leading-5 text-secondary">
                These details are shared with all admins of this wedding.
              </p>
            </>
          )}
          {step === 2 && (
            <>
              {selectField(
                "timeZone",
                "Wedding time zone",
                "Use the time zone where your wedding takes place. Events and reminders follow this setting.",
              )}
              {selectField(
                "currency",
                "Wedding currency",
                "Expense amounts will use this currency.",
              )}
              <p className="rounded-sm border border-bronze/15 bg-panel-light px-4 py-3 text-sm leading-5 text-secondary">
                All admins share these settings. Your details are saved when you
                continue.
              </p>
            </>
          )}
          {step === 3 && (
            <>
              {textField("venueName", "Venue name", "Enter venue name")}
              {textField(
                "venueAddress",
                "Venue address",
                "Enter venue address",
                false,
                true,
              )}
              <label className="flex min-h-11 items-center gap-3 text-sm leading-5 text-secondary">
                <input
                  type="checkbox"
                  checked={values.venueUndecided}
                  onChange={(event) =>
                    change("venueUndecided", event.target.checked)
                  }
                  disabled={disabled}
                  className="size-4 shrink-0 accent-primary"
                />
                We haven’t chosen a venue yet
              </label>
              <p className="text-sm text-secondary">
                You can add these details later in wedding settings.
              </p>
              <p className="rounded-sm border border-bronze/15 bg-panel-light px-4 py-3 text-sm leading-5 text-secondary">
                Finishing setup does not publish your wedding website.
              </p>
            </>
          )}
          <div className="flex items-center gap-4">
            {step > 1 && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => move((step - 1) as SetupStep)}
                className="min-h-12 px-3 text-sm text-secondary disabled:opacity-60"
              >
                ← Back
              </button>
            )}
            <button
              type="submit"
              disabled={disabled || conflict}
              className="min-h-12 flex-1 rounded-sm bg-primary px-6 py-3 text-base text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy
                ? "Saving…"
                : error && !conflict
                  ? "Try again"
                  : step === 3
                    ? "Finish setup"
                    : "Continue"}{" "}
              {!busy && <span aria-hidden="true">→</span>}
            </button>
          </div>
        </form>
      </section>
    </OnboardingShell>
  );
}
