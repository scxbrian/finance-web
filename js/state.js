import { currentMonth } from "./lib/dates.js";

const state = {
  month: currentMonth(),   // the month the user is looking at
  connection: "unknown",   // unknown | online | offline | unconfigured | mock
  user: null,              // the signed-in person, or null
};

const listeners = new Set();

export const getState = () => ({ ...state });

export function setState(patch) {
  const changed = Object.keys(patch).filter((key) => state[key] !== patch[key]);
  if (changed.length === 0) return;

  Object.assign(state, patch);
  const snapshot = getState();
  listeners.forEach((listener) => listener(snapshot, changed));
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}