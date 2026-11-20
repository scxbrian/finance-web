import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { installBrowser, fakeElement, flush } from "./env.mjs";
import { resolveRoute, routes, startRouter } from "../js/router.js";
import { currentMonth, shiftMonth } from "../js/lib/dates.js";
import { setState } from "../js/state.js";

const USER = { id: "u1", email: "a@b.co", display_name: "A" };

// ---- the guard, as a pure function -------------------------------------------------------
test("signed out, every private address leads to the sign-in screen", () => {
  for (const hash of ["", "#overview", "#ledger", "#scan", "#nonsense"]) {
    assert.deepEqual(resolveRoute(hash, null), { name: "login", redirected: true }, hash);
  }
  assert.deepEqual(resolveRoute("#login", null), { name: "login", redirected: false });
});

test("signed in, the sign-in screen leads home and unknown addresses fall back", () => {
  assert.deepEqual(resolveRoute("#login", USER), { name: "overview", redirected: true });
  assert.deepEqual(resolveRoute("#ledger", USER), { name: "ledger", redirected: false });
  assert.deepEqual(resolveRoute("#nonsense", USER), { name: "overview", redirected: true });
  assert.deepEqual(resolveRoute("", USER), { name: "overview", redirected: true });
});

test("only the sign-in screen is public", () => {
  assert.deepEqual(Object.keys(routes).filter((name) => routes[name].public), ["login"]);
});

// ---- the router running against a simulated page -----------------------------------------
let stop, outlet, controls, rendered;

// What the visitor currently sees: the content of the newest container in the page.
const screen = () => outlet.children.at(-1)?.innerHTML;

function setup(table) {
  installBrowser();
  outlet = fakeElement();
  controls = fakeElement();
  stop = startRouter({
    outlet,
    titleEl: fakeElement(),
    announcer: fakeElement(),
    controlsEl: controls,
    table,
  });
}

function view(name, { months = false, public: isPublic = false, render } = {}) {
  return {
    title: name,
    months,
    public: isPublic,
    load: async () => ({
      render: render ?? ((el) => {
        rendered.push(name);
        el.innerHTML = `<p>${name}</p>`;
      }),
    }),
  };
}

const navigate = async (hash) => {
  location.hash = hash;
  window.dispatchEvent(new Event("hashchange"));
  await flush();
};

beforeEach(() => {
  rendered = [];
  setState({ user: null, month: currentMonth() });
});
afterEach(() => stop?.());

test("signed out, any address shows the sign-in screen and the address is corrected", async () => {
  setup({ login: view("login", { public: true }), overview: view("overview") });
  location.hash = "#overview";
  await navigate("#overview");
  assert.equal(screen(), "<p>login</p>");
  assert.equal(location.hash, "#login");
});

test("signing in moves you off the sign-in screen without a click", async () => {
  setup({ login: view("login", { public: true }), overview: view("overview") });
  await flush();
  assert.equal(screen(), "<p>login</p>");
  setState({ user: USER });
  await flush();
  assert.equal(screen(), "<p>overview</p>");
  assert.equal(location.hash, "#overview");
});

test("signing out (or a lost session) puts the sign-in screen back", async () => {
  setState({ user: USER });
  setup({ login: view("login", { public: true }), overview: view("overview") });
  await flush();
  assert.equal(screen(), "<p>overview</p>");
  setState({ user: null });
  await flush();
  assert.equal(screen(), "<p>login</p>");
});

test("a slow screen that finishes late cannot paint over the one you moved to", async () => {
  setState({ user: USER });
  let releaseSlow;
  const slowGate = new Promise((resolve) => (releaseSlow = resolve));
  setup({
    login: view("login", { public: true }),
    overview: view("overview"),
    slow: view("slow", { render: async (el) => { await slowGate; el.innerHTML = "<p>SLOW (stale)</p>"; } }),
  });
  await navigate("#slow");
  await navigate("#overview");
  assert.equal(screen(), "<p>overview</p>");
  releaseSlow();
  await flush();
  assert.equal(screen(), "<p>overview</p>"); // still the current screen
});

test("a screen's cleanup runs when you leave it", async () => {
  setState({ user: USER });
  let cleaned = 0;
  setup({
    login: view("login", { public: true }),
    overview: view("overview"),
    ledger: view("ledger", { render: (el) => { el.innerHTML = "<p>ledger</p>"; return () => cleaned++; } }),
  });
  await navigate("#ledger");
  assert.equal(cleaned, 0);
  await navigate("#overview");
  assert.equal(cleaned, 1);
});

test("changing the month re-renders only screens that show a month", async () => {
  setState({ user: USER });
  setup({
    login: view("login", { public: true }),
    overview: view("overview", { months: true }),
    scan: view("scan"),
  });
  await navigate("#overview");
  const before = rendered.filter((n) => n === "overview").length;
  setState({ month: shiftMonth(currentMonth(), -1) });
  await flush();
  assert.equal(rendered.filter((n) => n === "overview").length, before + 1);

  await navigate("#scan");
  const scanRenders = rendered.filter((n) => n === "scan").length;
  setState({ month: shiftMonth(currentMonth(), -2) });
  await flush();
  assert.equal(rendered.filter((n) => n === "scan").length, scanRenders); // no month, no re-render
});

test("a screen that throws shows an error notice instead of a blank page", async () => {
  setState({ user: USER });
  setup({
    login: view("login", { public: true }),
    overview: view("overview", { render: () => { throw new Error("boom"); } }),
  });
  const original = console.error;
  console.error = () => {};
  await flush();
  console.error = original;
  assert.match(screen(), /Something went wrong/);
});

test("the month picker is mounted only for screens that use it, and cleaned up after", async () => {
  setState({ user: USER });
  setup({
    login: view("login", { public: true }),
    overview: view("overview", { months: true }),
    scan: view("scan"),
  });
  await navigate("#overview");
  assert.match(controls.innerHTML, /Previous month/);
  await navigate("#scan");
  assert.equal(controls.innerHTML === "" || controls.textContent === "", true);
});