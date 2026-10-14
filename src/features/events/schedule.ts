// Browser-safe display helpers; authoritative conversion runs on the server.
function formatter(timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    calendar: "gregory",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
}
export function localParts(instant: Date, timeZone: string) {
  const parts = Object.fromEntries(
    formatter(timeZone)
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.day}/${parts.month}/${parts.year}`,
    time: `${parts.hour}:${parts.minute}`,
    second: parts.second,
  };
}
function localEpoch(date: string, time: string) {
  const [day, month, year] = date.split("/").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return Date.UTC(year, month - 1, day, hour, minute);
}
export function resolveEventTime(date: string, time: string, timeZone: string) {
  const naive = localEpoch(date, time);
  const offsets = new Set<number>();
  // Sample both sides of local transitions, including half-hour DST and
  // date-line changes. Verify every candidate against the requested wall time.
  for (let hours = -48; hours <= 48; hours += 6) {
    const instant = new Date(naive + hours * 3600000);
    const p = localParts(instant, timeZone);
    offsets.add(
      localEpoch(p.date, p.time) + Number(p.second) * 1000 - instant.getTime(),
    );
  }
  const candidates = [...offsets]
    .map((offset) => new Date(naive - offset))
    .filter((instant) => {
      const p = localParts(instant, timeZone);
      return p.date === date && p.time === time && p.second === "00";
    });
  return candidates;
}
export function eventSchedule(
  values: { date: string; startTime: string; endDate: string; endTime: string },
  timeZone: string,
) {
  const fields: Record<string, string> = {};
  function resolve(date: string, time: string, field: string) {
    const candidates = resolveEventTime(date, time, timeZone);
    if (candidates.length !== 1) {
      fields[field] =
        candidates.length === 0
          ? "This time does not exist because the clocks change. Choose another time."
          : "This time occurs twice because the clocks change. Choose an unambiguous time.";
      return null;
    }
    return candidates[0];
  }
  const startsAt = resolve(values.date, values.startTime, "startTime");
  const endsAt = values.endTime
    ? resolve(values.endDate || values.date, values.endTime, "endTime")
    : null;
  if (startsAt && endsAt && endsAt < startsAt)
    fields.endTime =
      "The end must be at or after the start. For overnight events, enter the next day's date.";
  return { startsAt, endsAt, fields };
}
