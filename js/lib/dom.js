/* Small DOM helpers. The important one is html``, a tagged template that
   escapes every interpolated value unless it is already marked as safe. */

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

class SafeHtml {
  constructor(value) {
    this.value = value;
  }
  toString() {
    return this.value;
  }
}

// Marks trusted markup (for example an icon you wrote yourself) so html`` leaves it alone.
export const raw = (markup) => new SafeHtml(String(markup));

function renderValue(value) {
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(renderValue).join("");
  if (value === null || value === undefined || value === false) return "";
  return esc(value);
}

export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) {
    out += renderValue(values[i]) + strings[i + 1];
  }
  return new SafeHtml(out);
}

// Refuses plain strings, so a forgotten html`` can never inject unescaped text.
export function setHTML(element, markup) {
  if (!(markup instanceof SafeHtml)) {
    throw new TypeError("setHTML expects html`...` output, not a plain string.");
  }
  element.innerHTML = markup.value;
}