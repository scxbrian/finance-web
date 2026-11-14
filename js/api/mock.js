/* Development-only data source. Reached only when useMocks is true in config.js. */

import { ApiError } from "./client.js";

let cache = null;

async function load() {
  if (cache) return cache;
  const response = await fetch(new URL("../../mocks/dev-data.json", import.meta.url));
  if (!response.ok) {
    throw new ApiError("Could not load mocks/dev-data.json.", { code: "mock_missing" });
  }
  cache = await response.json();
  return cache;
}

export async function mockRequest(method, path) {
  // Refusing writes is the point: mock mode must never look like it saved anything.
  if (method !== "GET") {
    throw new ApiError("Mock mode is read-only. Nothing was saved.", { code: "mock_read_only" });
  }

  const data = await load();
  const entry = data[`GET ${path}`];
  if (entry === undefined) {
    throw new ApiError(`No mock data for GET ${path}.`, { code: "mock_missing", status: 404 });
  }

  await new Promise((resolve) => setTimeout(resolve, 120)); // keep loading states visible
  return structuredClone(entry);
}