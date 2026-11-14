import { api } from "./client.js";

// Resolves to a connection state, never throws.
export async function checkConnection() {
  if (window.FINANCE_CONFIG?.useMocks) return "mock";
  try {
    await api.get("/health", { timeoutMs: 5000 });
    return "online";
  } catch (err) {
    return err.code === "not_configured" ? "unconfigured" : "offline";
  }
}