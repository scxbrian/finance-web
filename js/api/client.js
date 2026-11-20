/* The only place in the app that calls fetch. Views import `api` from here. */

export class ApiError extends Error {
  constructor(message, { code = "error", status = 0, details = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.code = code;       // not_configured | timeout | network | http | bad_response | mock_*
    this.status = status;   // HTTP status, 0 when there was no response
    this.details = details; // parsed error body, if any
  }
}

const config = () => window.FINANCE_CONFIG || {};

// Mock data is for local development only. A deployed site ignores `useMocks`, so a forgotten
// `useMocks: true` can never show fake balances to a real visitor.
const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];
export function mocksEnabled() {
  return Boolean(config().useMocks) && LOCAL_HOSTS.includes(location.hostname);
}

export const isAbort = (err) => err?.name === "AbortError";

function messageFrom(data) {
  if (!data || typeof data !== "object") return "";
  if (typeof data.error?.message === "string") return data.error.message;
  if (typeof data.error === "string") return data.error;
  if (typeof data.detail === "string") return data.detail; // FastAPI's default shape
  return "";
}

export async function request(path, { method = "GET", query, body, signal, timeoutMs = 10000 } = {}) {
  const { apiBase } = config();

  if (mocksEnabled()) {
    // Loaded only on demand, so mock code never runs in a production session.
    const { mockRequest } = await import("./mock.js");
    return mockRequest(method, path);
  }
  if (!apiBase) {
    throw new ApiError("No backend is configured. Set apiBase in js/config.js.", { code: "not_configured" });
  }

  // "same-origin" is the normal deployed setup: the page's own host proxies /api to the server,
  // so the browser only ever talks to one origin and the session cookie is first-party.
  const base = apiBase === "same-origin" ? location.origin : apiBase;
  const url = new URL(`/api${path}`, base);
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }

  // One controller covers both the timeout and the caller's own cancellation.
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new DOMException("Timed out", "TimeoutError")),
    timeoutMs,
  );
  const onCallerAbort = () => controller.abort(signal.reason);
  if (signal) {
    if (signal.aborted) onCallerAbort();
    else signal.addEventListener("abort", onCallerAbort, { once: true });
  }

  let response;
  try {
    response = await fetch(url, {
      method,
      credentials: "include", // send the session cookie
      headers: {
        Accept: "application/json",
        ...(body !== undefined && { "Content-Type": "application/json" }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if (signal?.aborted) throw err; // the caller navigated away; not a failure
    if (err?.name === "TimeoutError") {
      throw new ApiError("The server took too long to respond.", { code: "timeout" });
    }
    throw new ApiError("Can't reach the server.", { code: "network" });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onCallerAbort);
  }

  // A wrong password is also a 401, but that is an answer to a question, not a lost session.
  if (response.status === 401 && path !== "/auth/login") {
    window.dispatchEvent(new CustomEvent("api:unauthorized"));
  }
  if (response.status === 204) return null;

  let data = null;
  try {
    data = await response.json();
  } catch {
    /* empty or non-JSON body; handled below */
  }

  if (!response.ok) {
    throw new ApiError(messageFrom(data) || `Request failed (${response.status}).`, {
      code: "http",
      status: response.status,
      details: data,
    });
  }
  if (data === null) {
    throw new ApiError("The server sent an unreadable response.", { code: "bad_response", status: response.status });
  }
  return data;
}

export const api = {
  get: (path, options) => request(path, { ...options, method: "GET" }),
  post: (path, body, options) => request(path, { ...options, method: "POST", body }),
  put: (path, body, options) => request(path, { ...options, method: "PUT", body }),
  delete: (path, options) => request(path, { ...options, method: "DELETE" }),
};