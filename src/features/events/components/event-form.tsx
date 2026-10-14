"use client";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import {
  emptyEventValues,
  eventValuesSchema,
  type EventContext,
  type EventDetail,
  type EventValues,
} from "../schemas";
const subscribe = () => () => {};
export function EventForm({
  initial,
  edit,
}: {
  initial: EventContext;
  edit?: EventDetail;
}) {
  const editing = Boolean(edit);
  const [saved, setSaved] = useState(edit ?? null);
  const [confirmReload, setConfirmReload] = useState(false);
  const [missing, setMissing] = useState(false);
  const [loadingLatest, setLoadingLatest] = useState(false);
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const [context, setContext] = useState(initial),
    [values, setValues] = useState({ ...(edit?.values ?? emptyEventValues) });
  const [fields, setFields] = useState<Record<string, string>>({}),
    [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false),
    [conflict, setConflict] = useState(false),
    [uncertain, setUncertain] = useState(false);
  const [leaveHref, setLeaveHref] = useState<string | null>(null);
  const saving = useRef(false),
    leaving = useRef(false);
  const attempt = useRef<{
    clientRequestId: string;
    expectedWeddingRevision?: number;
    expectedRevision?: number;
    values: EventValues;
  } | null>(null);
  const dirty = editing
    ? JSON.stringify(values) !== JSON.stringify(saved?.values)
    : Object.values(values).some(Boolean);
  const disabled =
    !ready ||
    busy ||
    uncertain ||
    missing ||
    confirmReload ||
    Boolean(leaveHref);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (!leaving.current) {
        event.preventDefault();
        event.returnValue = "";
      }
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
      setLeaveHref(anchor.href);
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", navigate, true);
    };
  }, [dirty]);
  useEffect(() => {
    if (!leaveHref && !confirmReload) return;
    document.getElementById("event-keep-editing")?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLeaveHref(null);
        setConfirmReload(false);
      }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [leaveHref, confirmReload]);
  function focusErrors(errors: Record<string, string>) {
    const first = Object.keys(errors)[0];
    if (first)
      requestAnimationFrame(() =>
        document.getElementById(`event-${first}`)?.focus(),
      );
  }
  function change(field: keyof EventValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setFields((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
    if (!conflict) setMessage("");
  }
  function authRedirect(response: Response) {
    if (response.status !== 401 && response.status !== 403) return false;
    leaving.current = true;
    window.location.replace(response.status === 401 ? "/login" : "/dashboard");
    return true;
  }
  async function reloadContext() {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setLoadingLatest(true);
    try {
      const response = await fetch(
        editing ? `/api/events/${saved!.id}` : "/api/events?context=1",
        {
          cache: "no-store",
          credentials: "same-origin",
        },
      );
      if (authRedirect(response)) return;
      const result = await response.json();
      if (!response.ok || !(editing ? result.event : result.context))
        throw new Error();
      if (editing) {
        setSaved(result.event);
        setValues(result.event.values);
        setContext(result.event);
        setFields({});
        setUncertain(false);
      } else setContext(result.context);
      setConflict(false);
      attempt.current = null;
      setMessage(
        editing
          ? "Latest saved event loaded."
          : "Latest wedding settings loaded. Check the time zone and schedule before creating your event.",
      );
    } catch {
      setMessage(
        editing
          ? "We couldn’t load the latest event. Your entries are still here. Please try again."
          : "We couldn’t load wedding settings. Your entries are still here. Please try again.",
      );
    } finally {
      saving.current = false;
      setBusy(false);
      setLoadingLatest(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      saving.current ||
      conflict ||
      missing ||
      !ready ||
      leaveHref ||
      confirmReload ||
      (editing && !dirty && !uncertain)
    )
      return;
    if (!attempt.current) {
      const parsed = eventValuesSchema.safeParse(values);
      if (!parsed.success) {
        const errors: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const key = issue.path[0];
          if (typeof key === "string" && !errors[key])
            errors[key] = issue.message;
        }
        setFields(errors);
        focusErrors(errors);
        setMessage("Please check the highlighted details.");
        return;
      }
      attempt.current = {
        clientRequestId: crypto.randomUUID(),
        ...(editing
          ? { expectedRevision: saved!.revision }
          : { expectedWeddingRevision: context.weddingRevision }),
        values: parsed.data,
      };
    }
    saving.current = true;
    setBusy(true);
    setFields({});
    setMessage("");
    try {
      const response = await fetch(
        editing ? `/api/events/${saved!.id}` : "/api/events",
        {
          method: editing ? "PATCH" : "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(attempt.current),
        },
      );
      if (authRedirect(response)) return;
      const result = await response.json();
      if (response.ok && result.id) {
        leaving.current = true;
        window.location.replace(
          new URL("/events", window.location.origin).href,
        );
        return;
      }
      if (response.status >= 500) throw new Error();
      setUncertain(false);
      if (
        result.code === "WEDDING_CHANGED" ||
        result.code === "EVENT_CHANGED" ||
        (editing && result.code === "REQUEST_REUSED")
      ) {
        setConflict(true);
        attempt.current = null;
      } else if (response.status === 404) {
        setMissing(true);
        attempt.current = null;
      } else if (result.code === "REQUEST_REUSED") {
        setUncertain(true);
      } else {
        attempt.current = null;
      }
      setMessage(
        result.message || "We couldn’t save this event. Please try again.",
      );
      if (result.fields) {
        setFields(result.fields);
        focusErrors(result.fields);
      }
    } catch {
      setUncertain(true);
      setMessage(
        editing
          ? "We couldn’t confirm the save. Your edits are kept. Retry the same request to check or finish saving safely."
          : "We couldn’t confirm the save. Your entries are kept. Retry the same request to check or finish saving without creating a duplicate.",
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  const inputClass =
    "mt-2 min-h-11 w-full rounded-sm border border-bronze/30 bg-white px-3 py-2 text-sm outline-offset-2 focus:outline-primary disabled:bg-panel-light disabled:text-secondary";
  function field(
    key: keyof EventValues,
    label: string,
    { optional = false, multiline = false, placeholder = "" } = {},
  ) {
    const id = `event-${key}`,
      error = fields[key];
    const props = {
      id,
      name: key,
      value: values[key],
      onChange: (
        event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      ) => change(key, event.target.value),
      disabled,
      placeholder,
      "aria-invalid": Boolean(error),
      "aria-describedby": error ? `${id}-error` : undefined,
      className: inputClass,
      maxLength:
        key === "description"
          ? 2000
          : key === "venueAddress" || key === "instructions"
            ? 1000
            : key.includes("Date") || key === "date"
              ? 10
              : key.includes("Time")
                ? 5
                : 200,
      required: !optional,
    };
    return (
      <div>
        <label
          htmlFor={id}
          className="flex justify-between text-sm text-primary"
        >
          <span>
            {label}
            {!optional && <span aria-hidden="true"> *</span>}
          </span>
          {optional && <span className="text-xs text-secondary">Optional</span>}
        </label>
        {multiline ? (
          <textarea {...props} rows={3} />
        ) : (
          <input {...props} type="text" />
        )}
        {error && (
          <p id={`${id}-error`} className="mt-2 text-sm text-red-800">
            {error}
          </p>
        )}
      </div>
    );
  }
  return (
    <section className="max-w-[800px]">
      <Link
        href="/events"
        className="inline-flex min-h-11 items-center text-sm text-secondary hover:text-primary"
      >
        ← Back to events
      </Link>
      <h1 className="mt-4 font-serif text-3xl text-primary">
        {editing ? "Edit event" : "Create event"}
      </h1>
      <p className="mt-2 text-sm text-secondary">
        {editing
          ? `Update details for ${saved!.values.name}.`
          : "Add a celebration to your wedding schedule."}
      </p>
      {!editing && !context.hasEvents && (
        <p className="mt-6 border border-bronze/20 bg-panel-light px-4 py-3 text-sm text-secondary">
          Creating your first event locks the wedding time zone. Check it before
          you save.
        </p>
      )}
      <form
        onSubmit={submit}
        noValidate
        className="mt-8 space-y-8"
        aria-busy={busy}
      >
        <fieldset disabled={disabled} className="space-y-5">
          <legend className="mb-5 font-serif text-xl">Event details</legend>
          {field("name", "Event name", { placeholder: "e.g. Welcome dinner" })}
          {field("description", "Description", {
            optional: true,
            multiline: true,
            placeholder: "What will happen at this celebration?",
          })}
        </fieldset>
        <fieldset
          disabled={disabled}
          className="space-y-5 border-t border-bronze/20 pt-6"
        >
          <legend className="font-serif text-xl">Schedule</legend>
          <p className="text-sm text-secondary">
            Wedding time zone:{" "}
            <strong className="font-medium text-primary">
              {context.timeZone}
            </strong>
          </p>
          <div className="grid grid-cols-2 gap-5">
            {field("date", "Event date", { placeholder: "DD/MM/YYYY" })}
            {field("startTime", "Start time", { placeholder: "14:00" })}
            {field("endDate", "End date", {
              optional: true,
              placeholder: "DD/MM/YYYY",
            })}
            {field("endTime", "End time", {
              optional: true,
              placeholder: "15:00",
            })}
          </div>
          <p className="text-xs text-secondary">
            Use the 24-hour clock. Leave the end date blank for the same day;
            enter the next date for an overnight event.
          </p>
        </fieldset>
        <fieldset
          disabled={disabled}
          className="space-y-5 border-t border-bronze/20 pt-6"
        >
          <legend className="font-serif text-xl">Venue</legend>
          {field("venueName", "Venue name", {
            placeholder: "e.g. Garden Pavilion",
          })}
          {field("venueAddress", "Venue address", {
            placeholder: "Street address, city and postcode",
          })}
          {field("instructions", "Arrival instructions", {
            optional: true,
            multiline: true,
            placeholder: "Entrance, parking or accessibility details",
          })}
        </fieldset>
        {message && (
          <div
            role="alert"
            className="border border-bronze/30 bg-panel-light p-4 text-sm text-primary"
          >
            <p>{message}</p>
            {conflict && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (editing && dirty) setConfirmReload(true);
                  else void reloadContext();
                }}
                className="mt-3 min-h-11 underline"
              >
                {editing
                  ? "Load latest saved event"
                  : "Load latest wedding settings"}
              </button>
            )}
            {uncertain && (
              <Link
                href="/events"
                className="mt-3 inline-flex min-h-11 items-center underline"
              >
                Check event list
              </Link>
            )}
          </div>
        )}
        <div className="border-t border-bronze/20 pt-6">
          <div className="flex gap-3">
            <Link
              href="/events"
              className="inline-flex min-h-11 items-center rounded-sm border border-bronze/30 px-5 text-sm"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={
                !ready ||
                busy ||
                conflict ||
                missing ||
                confirmReload ||
                Boolean(leaveHref) ||
                (editing && !dirty && !uncertain)
              }
              className="min-h-11 rounded-sm bg-primary px-5 text-sm text-white disabled:opacity-50"
            >
              {busy
                ? loadingLatest
                  ? "Loading…"
                  : "Saving…"
                : uncertain
                  ? "Retry same request"
                  : editing
                    ? "Save changes →"
                    : "Create event →"}
            </button>
          </div>
          <p className="mt-4 text-xs text-secondary">
            {editing
              ? "Saving changes does not publish the event or send notifications."
              : "Saving an event does not publish it or send invitations."}
          </p>
        </div>
      </form>
      {(leaveHref || confirmReload) && (
        <div
          role="alertdialog"
          aria-labelledby="event-leave-title"
          aria-describedby="event-leave-body"
          className="mt-6 border border-bronze/40 bg-white p-6"
        >
          <h2 id="event-leave-title" className="font-serif text-xl">
            {confirmReload ? "Replace your unsaved edits?" : "Leave this form?"}
          </h2>
          <p id="event-leave-body" className="mt-3 text-sm text-secondary">
            {confirmReload
              ? "Loading the latest saved event will replace your current entries. You can keep editing to copy them first."
              : uncertain
                ? "The save outcome is unknown. Check the event list before saving again."
                : "Your unsaved event details will be lost."}
          </p>
          <div className="mt-5 flex gap-3">
            <button
              id="event-keep-editing"
              type="button"
              onClick={() => {
                setLeaveHref(null);
                setConfirmReload(false);
              }}
              className="min-h-11 border border-bronze/30 px-4 text-sm"
            >
              Keep editing
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirmReload) {
                  setConfirmReload(false);
                  void reloadContext();
                } else {
                  leaving.current = true;
                  window.location.assign(leaveHref!);
                }
              }}
              className="min-h-11 bg-primary px-4 text-sm text-white"
            >
              {confirmReload ? "Load latest event" : "Leave form"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
