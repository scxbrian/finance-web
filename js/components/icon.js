import { html } from "../lib/dom.js";

export const icon = (name) =>
  html`<svg class="icon" aria-hidden="true"><use href="assets/icons.svg#${name}"></use></svg>`;