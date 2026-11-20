/* Hash router. Every navigation gets its OWN container inside the page's content area, and the
   previous one is removed. A screen that finishes late (a slow request, a forgotten check)
   therefore writes into a container that is no longer on the page, and cannot paint over the
   screen you moved to. Screens should still pass `signal` to their requests, to avoid wasted work.

   A route is { title, load, public?, months? }:
     load()   lazily imports the view module
     public   reachable without signing in (only the sign-in screen)
     months   show the month picker in the top bar
   A view module exports render(outlet, { signal }) and may return a cleanup function. */

import { errorNotice } from "./components/notice.js";
import { mountMonthNav } from "./components/month-nav.js";
import { setHTML } from "./lib/dom.js";
import { getState, subscribe } from "./state.js";

export const routes = {
  login:    { title: "Sign in",  public: true,  load: () => import("./views/login.js") },
  overview: { title: "Home",     months: true,  load: () => import("./views/overview.js") },
  ledger:   { title: "Ledger",   months: true,  load: () => import("./views/ledger.js") },
  scan:     { title: "Scan",                    load: () => import("./views/scan.js") },
  insights: { title: "Insights", months: true,  load: () => import("./views/insights.js") },
  scores:   { title: "Scores",   months: true,  load: () => import("./views/scores.js") },
};

const DEFAULT_ROUTE = "overview";

/* Pure: which screen should this address show for this visitor?
   Signed out, everything except the sign-in screen redirects there; signed in, the
   sign-in screen redirects away. An unknown address falls back to the default. */
export function resolveRoute(hash, user, table = routes) {
  const requested = hash.replace(/^#/, "");
  const name = table[requested] ? requested : DEFAULT_ROUTE;

  if (!table[name].public && !user) return { name: "login", redirected: true };
  if (name === "login" && user) return { name: DEFAULT_ROUTE, redirected: true };
  return { name, redirected: name !== requested };
}

function markActive(name) {
  document.querySelectorAll("[data-route]").forEach((link) => {
    if (link.dataset.route === name) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

export function startRouter({ outlet, titleEl, announcer, controlsEl, table = routes }) {
  let controller = null;
  let teardown = null;
  let teardownMonths = null;
  let firstRender = true;
  let active = null;

  async function show() {
    const { name, redirected } = resolveRoute(location.hash, getState().user, table);
    const route = table[name];
    if (redirected) history.replaceState(null, "", `#${name}`);

    // Cancel the previous screen: its requests abort and its cleanup runs.
    controller?.abort();
    teardown?.();
    teardown = null;
    teardownMonths?.();
    teardownMonths = null;
    active = route;

    controller = new AbortController();
    const { signal } = controller;

    markActive(name);
    titleEl.textContent = route.title;
    document.title = `${route.title} · Finance Tracker`;
    if (route.months) teardownMonths = mountMonthNav(controlsEl);
    outlet.setAttribute("aria-busy", "true");

    const root = document.createElement("div");
    root.className = "view-root";
    outlet.replaceChildren(root); // the previous screen's container is gone from the page

    try {
      const view = await route.load();
      if (signal.aborted) return;

      const result = await view.render(root, { signal });
      if (signal.aborted) {
        if (typeof result === "function") result();
        return;
      }
      teardown = typeof result === "function" ? result : null;
    } catch (err) {
      if (signal.aborted) return;
      setHTML(root, errorNotice(err));
    }

    outlet.removeAttribute("aria-busy");
    if (!firstRender) {
      window.scrollTo(0, 0);
      outlet.focus({ preventScroll: true });
      announcer.textContent = route.title;
    }
    firstRender = false;
  }

  window.addEventListener("hashchange", show);
  // Signing in or out changes what every address means; a new month changes what a screen shows.
  const unsubscribe = subscribe((_state, changed) => {
    if (changed.includes("user") || (changed.includes("month") && active?.months)) show();
  });
  show();

  return function stop() {
    window.removeEventListener("hashchange", show);
    unsubscribe();
    controller?.abort();
    teardown?.();
    teardownMonths?.();
  };
}