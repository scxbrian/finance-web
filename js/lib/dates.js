/* Date helpers. They use the device's local calendar on purpose:
   toISOString() converts to UTC, which in Kenya (UTC+3) returns
   yesterday's date between midnight and 3 a.m. */

const pad = (n) => String(n).padStart(2, "0");

export function todayISO(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function currentMonth(now = new Date()) {
  return todayISO(now).slice(0, 7);
}

// shiftMonth("2026-11", -2) -> "2026-09"
export function shiftMonth(month, delta) {
  const [year, mon] = month.split("-").map(Number);
  const index = year * 12 + (mon - 1) + delta;
  return `${String(Math.floor(index / 12)).padStart(4, "0")}-${pad((index % 12) + 1)}`;
}

// formatMonth("2026-11") -> "November 2026"
export function formatMonth(month) {
  const [year, mon] = month.split("-").map(Number);
  return new Date(year, mon - 1, 1).toLocaleDateString("en-KE", { month: "long", year: "numeric" });
}

function parseISO(iso) {
  const [year, mon, day] = iso.split("-").map(Number);
  return new Date(year, mon - 1, day); // local midnight, so no UTC shift
}

// formatDay("2026-11-14") -> "14 Nov"
export function formatDay(iso) {
  return parseISO(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short" });
}

// formatRange("2026-11-01", "2026-11-15") -> "1–15 Nov"
export function formatRange(fromISO, toISO) {
  const from = parseISO(fromISO);
  const to = parseISO(toISO);
  const sameMonth = from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth();

  if (sameMonth) {
    if (from.getDate() === to.getDate()) return formatDay(toISO);
    const month = to.toLocaleDateString("en-KE", { month: "short" });
    return `${from.getDate()}–${to.getDate()} ${month}`;
  }
  return `${formatDay(fromISO)} – ${formatDay(toISO)}`;
}

// formatDayLong("2026-11-14") -> "Sat, 14 Nov" (the heading above each day in the ledger)
export function formatDayLong(iso) {
  return parseISO(iso).toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short" });
}