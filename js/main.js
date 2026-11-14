import { $ } from "./lib/dom.js";
import { initTheme } from "./components/theme.js";
import { checkConnection } from "./api/health.js";
import { getState, setState, subscribe } from "./state.js";
import { startRouter } from "./router.js";

const STATUS_LABELS = {
  unknown: "Checking…",
  online: "Connected",
  offline: "Offline",
  unconfigured: "No backend",
  mock: "Mock data",
};

function bindConnectionStatus() {
  const el = $("#conn-status");
  const paint = ({ connection }) => {
    el.dataset.state = connection;
    el.textContent = STATUS_LABELS[connection] ?? connection;
  };
  paint(getState());
  subscribe(paint);
}

async function refreshConnection() {
  setState({ connection: await checkConnection() });
}

initTheme($("#theme-toggle"));
bindConnectionStatus();
startRouter({
  outlet: $("#view"),
  titleEl: $("#page-title"),
  announcer: $("#route-announcer"),
});

refreshConnection();
window.addEventListener("online", refreshConnection);
window.addEventListener("offline", refreshConnection);