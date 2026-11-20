import { api, mocksEnabled } from "./client.js";

// Resolves to a connection state, never throws.
export async function checkConnection() {
  if (mocksEnabled()) return "mock";
  try {
    await api.get("/health", { timeoutMs: 5000 });
    return "online";
  } catch (err) {
    return err.code === "not_configured" ? "unconfigured" : "offline";
  }
}