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