import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import { installBrowser, jsonResponse } from "./env.mjs";
import { api, ApiError, isAbort, mocksEnabled } from "../js/api/client.js";

let calls;
beforeEach(() => {
  calls = [];
  installBrowser({ origin: "https://finance-web.example.com", hostname: "finance-web.example.com", config: { apiBase: "same-origin" } });
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return jsonResponse({ ok: true });
  };
});

test("same-origin sends requests to the page's own host, with credentials", async () => {
  await api.get("/overview", { query: { month: "2026-11", skipped: undefined, empty: null } });
  assert.equal(calls[0].url, "https://finance-web.example.com/api/overview?month=2026-11");
  assert.equal(calls[0].options.credentials, "include");
  assert.equal(calls[0].options.method, "GET");
});

test("an explicit apiBase is used as given", async () => {
  window.FINANCE_CONFIG.apiBase = "http://127.0.0.1:8001";
  await api.get("/health");
  assert.equal(calls[0].url, "http://127.0.0.1:8001/api/health");
});

test("a JSON body is sent with the right header", async () => {
  await api.post("/auth/login", { email: "a@b.co", password: "x" });
  assert.equal(calls[0].options.headers["Content-Type"], "application/json");
  assert.equal(calls[0].options.body, JSON.stringify({ email: "a@b.co", password: "x" }));
});

test("no apiBase means 'not configured', never a silent fallback", async () => {
  window.FINANCE_CONFIG.apiBase = "";
  await assert.rejects(api.get("/health"), (e) => e instanceof ApiError && e.code === "not_configured");
  assert.equal(calls.length, 0);
});

test("a lost session raises one app-wide event", async () => {
  let events = 0;
  window.addEventListener("api:unauthorized", () => events++);
  globalThis.fetch = async () => jsonResponse({ error: { code: "unauthorized", message: "Sign in required." } }, 401);
  await assert.rejects(api.get("/overview"), (e) => e.status === 401 && e.message === "Sign in required.");
  assert.equal(events, 1);
});

test("a wrong password is an answer, not a lost session", async () => {
  let events = 0;
  window.addEventListener("api:unauthorized", () => events++);
  globalThis.fetch = async () => jsonResponse({ error: { code: "unauthorized", message: "Email or password is incorrect." } }, 401);
  await assert.rejects(api.post("/auth/login", { email: "a", password: "b" }), (e) => e.message === "Email or password is incorrect.");
  assert.equal(events, 0);
});

test("error bodies in the contract's shape and FastAPI's default shape both give a message", async () => {
  globalThis.fetch = async () => jsonResponse({ error: { code: "validation_error", message: "Some fields are invalid.", fields: { month: "bad" } } }, 422);
  await assert.rejects(api.get("/overview"), (e) => e.message === "Some fields are invalid." && e.details.error.fields.month === "bad");
  globalThis.fetch = async () => jsonResponse({ detail: "Not Found" }, 404);
  await assert.rejects(api.get("/nope"), (e) => e.message === "Not Found");
  globalThis.fetch = async () => jsonResponse(null, 500);
  await assert.rejects(api.get("/x"), (e) => e.message === "Request failed (500).");
});

test("an unreachable server is a 'network' error", async () => {
  globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
  await assert.rejects(api.get("/health"), (e) => e.code === "network");
});

test("a stalled server times out instead of hanging", async () => {
  globalThis.fetch = (_url, { signal }) =>
    new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason)));
  await assert.rejects(api.get("/health", { timeoutMs: 20 }), (e) => e.code === "timeout");
});

test("navigating away aborts the request and is not reported as a failure", async () => {
  globalThis.fetch = (_url, { signal }) =>
    new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason)));
  const controller = new AbortController();
  const pending = api.get("/overview", { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, (e) => isAbort(e));
});

test("a 204 and an unreadable body are told apart", async () => {
  globalThis.fetch = async () => ({ status: 204, ok: true, json: async () => { throw new Error("no body"); } });
  assert.equal(await api.post("/x", {}), null);
  globalThis.fetch = async () => ({ status: 200, ok: true, json: async () => { throw new Error("not json"); } });
  await assert.rejects(api.get("/x"), (e) => e.code === "bad_response");
});

test("mock mode works on a local host but is ignored on a deployed one", () => {
  installBrowser({ hostname: "localhost", config: { useMocks: true } });
  assert.equal(mocksEnabled(), true);
  installBrowser({ hostname: "finance-web.vercel.app", config: { useMocks: true } });
  assert.equal(mocksEnabled(), false); // a forgotten useMocks can never show fake money to a visitor
});