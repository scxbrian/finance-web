import { html } from "../lib/dom.js";
import { formatKES } from "../lib/money.js";
import { describeChange } from "../lib/delta.js";
import { icon } from "./icon.js";

function chip(change) {
  return html`
    <span class="chip" data-tone="${change.tone}">
      ${change.glyph ? icon(change.glyph) : ""}
      <span class="visually-hidden">${change.word} </span>${change.text}
    </span>
  `;
}

// basis: what the comparison is against, for example "vs 1–15 Oct".
export function statCard({ iconName, label, minor, previous, goodWhen = "up", basis }) {
  const change = describeChange(minor, previous, { goodWhen });
  return html`
    <article class="card">
      <div class="stat">
        <div class="stat-head"><span class="tile">${icon(iconName)}</span><span>${label}</span></div>
        <div class="stat-value num">${formatKES(minor, { cents: false })}</div>
        <div class="stat-foot">
          ${change ? chip(change) : ""}
          <span>${change ? basis : "Nothing to compare yet"}</span>
        </div>
      </div>
    </article>
  `;
}