import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import { installBrowser, fakeElement } from "./env.mjs";
import { buildQuery, groupByDay, KINDS, PAGE_SIZE } from "../js/views/ledger.js";
import { failureMessage } from "../js/views/login.js";
import { transactionRow } from "../js/components/transaction-row.js";
import { mountMonthNav } from "../js/components/month-nav.js";
import { currentMonth, shiftMonth } from "../js/lib/dates.js";
import { getState, setState } from "../js/state.js";

beforeEach(() => installBrowser());

// ---- what is asked of the server ---------------------------------------------------------
test("'All' and a blank search are left out of the request", () => {
  assert.deepEqual(buildQuery({ month: "2026-11", kind: "all", q: "  ", offset: 0 }), {
    month: "2026-11", limit: PAGE_SIZE, offset: 0,
  });
});

test("filters, a trimmed search and the paging offset are all sent", () => {
  assert.deepEqual(buildQuery({ month: "2026-11", kind: "expense", q: " naivas ", offset: 50 }), {
    month: "2026-11", limit: PAGE_SIZE, offset: 50, kind: "expense", q: "naivas",
  });
});

test("every filter chip is a kind the API accepts", () => {
  const accepted = new Set(["all", "income", "expense", "transfer", "opening", "adjustment"]);
  assert.ok(KINDS.every(([value]) => accepted.has(value)));
});

// ---- grouping under day headings ---------------------------------------------------------
test("rows are grouped by consecutive day, newest first, and pages join up", () => {
  const row = (day, id) => ({ id, occurred_on: day });
  const page1 = [row("2026-11-14", 1), row("2026-11-14", 2), row("2026-11-13", 3)];
  const page2 = [row("2026-11-13", 4), row("2026-11-10", 5)];
  const groups = groupByDay(page1.concat(page2));
  assert.deepEqual(groups.map((g) => [g.day, g.rows.map((r) => r.id)]), [
    ["2026-11-14", [1, 2]], ["2026-11-13", [3, 4]], ["2026-11-10", [5]],
  ]);
  assert.deepEqual(groupByDay([]), []);
});

// ---- one row on screen -------------------------------------------------------------------
const base = {
  id: "t1", occurred_on: "2026-11-14", title: "Naivas", fee_minor: 0, category: "Groceries",
  account: { id: "a1", name: "M-Pesa" }, to_account: null, source: "sms",
};

test("an expense shows a minus, an income a plus, a transfer neither", () => {
  const spend = String(transactionRow({ ...base, kind: "expense", amount_minor: 234000 }));
  const earn = String(transactionRow({ ...base, kind: "income", amount_minor: 6500000, category: "Salary" }));
  const move = String(transactionRow({ ...base, kind: "transfer", amount_minor: 1000000, category: null, to_account: { id: "a2", name: "Bank" } }));
  assert.match(spend, /-KES 2,340\.00/);
  assert.match(earn, /\+KES 65,000\.00/);
  assert.match(earn, /data-tone="pos"/);
  assert.match(move, /KES 10,000\.00/);
  assert.doesNotMatch(move, /[+-]KES/);
  assert.match(move, /M-Pesa to Bank/);
});

test("a fee is shown as part of the amount", () => {
  const row = String(transactionRow({ ...base, kind: "expense", amount_minor: 50700, fee_minor: 700 }));
  assert.match(row, /-KES 507\.00/);
  assert.match(row, /incl\. KES 7\.00 fee/);
});

test("an unknown kind from a newer server is shown neutrally, never as spending", () => {
  const row = String(transactionRow({ ...base, kind: "refund_v2", amount_minor: 999 }));
  assert.doesNotMatch(row, /[+-]KES/);
});

test("text that came from an SMS cannot inject markup", () => {
  const row = String(transactionRow({ ...base, kind: "expense", amount_minor: 100, title: `<img src=x onerror=alert(1)>` }));
  assert.doesNotMatch(row, /<img/);
  assert.match(row, /&lt;img/);
});

// ---- the sign-in screen's wording --------------------------------------------------------
test("sign-in failures read as plain advice", () => {
  assert.match(failureMessage({ code: "network" }), /Can't reach the server/);
  assert.match(failureMessage({ code: "timeout" }), /too long/);
  assert.equal(failureMessage({ code: "http", message: "Email or password is incorrect." }), "Email or password is incorrect.");
  assert.equal(failureMessage(null), "Something went wrong. Try again.");
});

// ---- the month picker --------------------------------------------------------------------
const buttonFor = (step) => ({ closest: () => ({ dataset: { step: String(step) }, disabled: false }) });

test("stepping back and forward changes the shared month", () => {
  const el = fakeElement();
  setState({ month: currentMonth() });
  const unmount = mountMonthNav(el);
  el.click(buttonFor(-1));
  assert.equal(getState().month, shiftMonth(currentMonth(), -1));
  el.click(buttonFor(1));
  assert.equal(getState().month, currentMonth());
  unmount();
});

test("you cannot step past the current month", () => {
  const el = fakeElement();
  setState({ month: currentMonth() });
  const unmount = mountMonthNav(el);
  assert.match(el.innerHTML, /aria-label="Next month"\s+disabled/);
  setState({ month: shiftMonth(currentMonth(), -1) });
  assert.doesNotMatch(el.innerHTML, /aria-label="Next month"\s+disabled/); // past months can go forward
  unmount();
});

test("the picker repaints when the month changes and stops listening when removed", () => {
  const el = fakeElement();
  setState({ month: currentMonth() });
  const unmount = mountMonthNav(el);
  const before = el.innerHTML;
  setState({ month: shiftMonth(currentMonth(), -3) });
  assert.notEqual(el.innerHTML, before);
  unmount();
  assert.equal(el.listeners.click.length, 0);
  const after = el.innerHTML;
  setState({ month: currentMonth() });
  assert.equal(el.innerHTML, after); // unsubscribed: no more repainting
});