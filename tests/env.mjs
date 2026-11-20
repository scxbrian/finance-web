// A tiny stand-in for the browser, so the app's logic can be tested with plain Node.
export function installBrowser({ hostname = "localhost", origin = "http://localhost:5500", config = {} } = {}) {
  const win = new EventTarget();
  win.FINANCE_CONFIG = config;
  win.scrollTo = () => {};
  globalThis.window = win;
  globalThis.location = { hostname, origin, hash: "" };
  globalThis.history = {
    replaceState(_state, _title, url) {
      globalThis.location.hash = url;
    },
  };
  globalThis.document = {
    title: "",
    querySelectorAll: () => [],
    getElementById: () => null,
    createElement: () => fakeElement(),
  };
  return win;
}

export function fakeElement() {
  return {
    innerHTML: "",
    textContent: "",
    attrs: {},
    listeners: {},
    setAttribute(key, value) { this.attrs[key] = value; },
    removeAttribute(key) { delete this.attrs[key]; },
    children: [],
    replaceChildren(...nodes) { this.children = nodes; },
    focus() {},
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
    removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter((f) => f !== fn); },
    click(target) { (this.listeners.click || []).forEach((fn) => fn({ target })); },
  };
}

export const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

export function jsonResponse(body, status = 200) {
  return { status, ok: status >= 200 && status < 300, json: async () => body };
}