import { api, isAbort } from "../api/client.js";
import { getState } from "../state.js";
import { html, setHTML } from "../lib/dom.js";
import { formatDayLong } from "../lib/dates.js";
import { errorNotice, notice } from "../components/notice.js";
import { transactionRow } from "../components/transaction-row.js";

export const PAGE_SIZE = 50;
export const KINDS = [
  ["all", "All"],
  ["expense", "Spending"],
  ["income", "Income"],
  ["transfer", "Transfers"],
];

// The query string for one page. "All" and blank search are simply left out.
export function buildQuery({ month, kind, q, offset }) {
  const query = { month, limit: PAGE_SIZE, offset };
  if (kind && kind !== "all") query.kind = kind;
  if (q && q.trim()) query.q = q.trim();
  return query;
}

// Rows arrive newest first, so consecutive rows with the same day belong under one heading.
export function groupByDay(rows) {
  const groups = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.day === row.occurred_on) last.rows.push(row);
    else groups.push({ day: row.occurred_on, rows: [row] });
  }
  return groups;
}

const shell = () => html`
  <section class="card">
    <div class="card-head">
      <div>
        <h2 class="card-title">Transactions</h2>
        <p id="ledger-count" class="eyebrow" aria-live="polite">Loading…</p>
      </div>
    </div>
    <div class="filters">
      <input id="ledger-search" class="input" type="search" placeholder="Search title or note"
             aria-label="Search transactions" autocomplete="off">
      <div class="chips" role="group" aria-label="Type">
        ${KINDS.map(
          ([value, label]) => html`<button type="button" class="chip-btn" data-kind="${value}"
            aria-pressed="${value === "all" ? "true" : "false"}">${label}</button>`,
        )}
      </div>
    </div>
    <div id="ledger-list" aria-busy="true"></div>
    <button type="button" id="ledger-more" class="btn btn-soft btn-block" hidden>Show more</button>
  </section>
`;

export function render(outlet, { signal }) {
  setHTML(outlet, shell());
  const countEl = outlet.querySelector("#ledger-count");
  const listEl = outlet.querySelector("#ledger-list");
  const moreEl = outlet.querySelector("#ledger-more");
  const searchEl = outlet.querySelector("#ledger-search");
  const chips = [...outlet.querySelectorAll("[data-kind]")];

  const filters = { kind: "all", q: "" };
  let rows = [];
  let total = 0;
  let current = null; // the in-flight request, so a newer search cancels an older one
  let timer = null;

  function paint() {
    countEl.textContent = `${total} ${total === 1 ? "entry" : "entries"}`;
    if (rows.length === 0) {
      const filtered = filters.kind !== "all" || filters.q.trim();
      setHTML(listEl, notice({
        title: filtered ? "Nothing matches" : "Nothing recorded this month",
        body: filtered ? "Try a different search or filter." : "Transactions appear here as they are recorded.",
      }));
    } else {
      setHTML(listEl, html`${groupByDay(rows).map((group) => html`
        <section class="day">
          <h3 class="day-title">${formatDayLong(group.day)}</h3>
          <ul class="rows">${group.rows.map(transactionRow)}</ul>
        </section>`)}`);
    }
    listEl.removeAttribute("aria-busy");
    moreEl.hidden = rows.length >= total;
  }

  async function load(reset) {
    current?.abort();
    const controller = new AbortController();
    current = controller;
    signal.addEventListener("abort", () => controller.abort(), { once: true });
    if (reset) listEl.setAttribute("aria-busy", "true");

    try {
      const query = buildQuery({ month: getState().month, ...filters, offset: reset ? 0 : rows.length });
      const data = await api.get("/transactions", { query, signal: controller.signal });
      if (controller.signal.aborted) return;
      rows = reset ? data.transactions : rows.concat(data.transactions);
      total = data.total;
      paint();
    } catch (err) {
      if (isAbort(err)) return;
      countEl.textContent = "";
      moreEl.hidden = true;
      setHTML(listEl, errorNotice(err));
      listEl.removeAttribute("aria-busy");
    }
  }

  chips.forEach((chip) =>
    chip.addEventListener("click", () => {
      filters.kind = chip.dataset.kind;
      chips.forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
      load(true);
    }),
  );
  searchEl.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      filters.q = searchEl.value;
      load(true);
    }, 300); // wait for a pause in typing instead of asking the server on every key
  });
  moreEl.addEventListener("click", () => load(false));

  load(true);
  return () => {
    clearTimeout(timer);
    current?.abort();
  };
}