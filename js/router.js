/* Hash router. A route is { title, load }, where load() lazily imports a view module.
   A view module exports render(outlet, { signal }) and may return a cleanup function. */

import { errorNotice } from "./components/notice.js";
import { setHTML } from "./lib/dom.js";

const routes = {
  overview: { title: "Home",     load: () => import("./views/overview.js") },
  ledger:   { title: "Ledger",   load: () => import("./views/ledger.js") },
  scan:     { title: "Scan",     load: () => import("./views/scan.js") },
  insights: { title: "Insights", load: () => import("./views/insights.js") },
  scores:   { title: "Scores",   load: () => import("./views/scores.js") },
};

const DEFAULT_ROUTE = "overview";

function currentRoute() {
  const name = location.hash.slice(1);
  return routes[name] ? name : DEFAULT_ROUTE;
}

function markActive(name) {
  document.querySelectorAll("[data-route]").forEach((link) => {
    if (link.dataset.route === name) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

export function startRouter({ outlet, titleEl, announcer }) {
  let controller = null;
  let teardown = null;
  let firstRender = true;

  async function show() {
    const name = currentRoute();
    const route = routes[name];
    if (location.hash.slice(1) !== name) history.replaceState(null, "", `#${name}`);

    // Cancel the previous screen: its requests abort and its cleanup runs.
    controller?.abort();
    teardown?.();
    teardown = null;

    controller = new AbortController();
    const { signal } = controller;

    markActive(name);
    titleEl.textContent = route.title;
    document.title = `${route.title} · Finance Tracker`;
    outlet.setAttribute("aria-busy", "true");

    try {
      const view = await route.load();
      if (signal.aborted) return;

      const result = await view.render(outlet, { signal });
      if (signal.aborted) {
        if (typeof result === "function") result();
        return;
      }
      teardown = typeof result === "function" ? result : null;
    } catch (err) {
      if (signal.aborted) return;
      setHTML(outlet, errorNotice(err));
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
  show();
}