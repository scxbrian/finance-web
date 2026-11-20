import { $ } from "./lib/dom.js";
import { initTheme } from "./components/theme.js";
import { showToast } from "./components/toast.js";
import { mocksEnabled } from "./api/client.js";
import { fetchSession, signOut } from "./api/auth.js";
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

async function onSignOut() {
  try {
    await signOut();
  } catch (err) {
    showToast(err.message); // still signed in: say why, do not pretend
    return;
  }
  setState({ user: null });
}

async function boot() {
  initTheme($("#theme-toggle"));
  bindConnectionStatus();

  // A session that ended (expired, revoked, signed out elsewhere) sends you to the sign-in screen.
  window.addEventListener("api:unauthorized", () => setState({ user: null }));
  const paintAuth = ({ user }) => {
    document.body.dataset.auth = user ? "in" : "out";
  };
  subscribe(paintAuth);

  // Ask who is signed in BEFORE the first screen, so nobody sees a flash of the wrong one.
  setState({ user: await fetchSession() });
  paintAuth(getState());

  const signOutButton = $("#sign-out");
  signOutButton.addEventListener("click", onSignOut);
  signOutButton.hidden = mocksEnabled(); // mock mode has no real session to end

  startRouter({
    outlet: $("#view"),
    titleEl: $("#page-title"),
    announcer: $("#route-announcer"),
    controlsEl: $("#topbar-controls"),
  });

  refreshConnection();
  window.addEventListener("online", refreshConnection);
  window.addEventListener("offline", refreshConnection);
}

boot();