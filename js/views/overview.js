import { api, isAbort } from "../api/client.js";
import { getState } from "../state.js";
import { html, setHTML } from "../lib/dom.js";
import { formatKES } from "../lib/money.js";
import { formatMonth, formatRange } from "../lib/dates.js";
import { icon } from "../components/icon.js";
import { statCard } from "../components/stat-card.js";
import { transactionRow } from "../components/transaction-row.js";
import { notice } from "../components/notice.js";

const ACCOUNT_ICONS = { mpesa: "phone", bank: "bank", cash: "cash", savings: "wallet" };

export async function render(outlet, { signal }) {
  setHTML(outlet, skeleton());

  let data;
  let reconcileData = null;
  try {
    [data, reconcileData] = await Promise.all([
      api.get("/overview", { query: { month: getState().month }, signal }),
      api.get("/reconcile", { signal }).catch((err) => {
        if (isAbort(err)) throw err;
        return null;
      }),
    ]);
  } catch (err) {
    if (isAbort(err)) return; // navigated away; the router handles it
    throw err;                // anything else becomes an error notice
  }
  if (signal.aborted) return;

  setHTML(outlet, page(data, reconcileData));
}

function skeleton() {
  return html`
    <div class="stack" aria-hidden="true">
      <div class="skeleton skeleton--hero"></div>
      <div class="skeleton skeleton--strip"></div>
      <div class="skeleton skeleton--card"></div>
    </div>
  `;
}

function page(d, reconcileData) {
  const basis = `vs ${formatRange(d.previous_period.from, d.previous_period.to)}`;
  const { summary } = d;
  const previous = summary.previous;

  return html`
    <div class="stack">
      <p class="eyebrow">${formatMonth(d.month)} · ${formatRange(d.period.from, d.period.to)}</p>

      ${reconciliationNotice(reconcileData)}

      <section class="card" aria-label="Total balance">
        <div class="stat">
          <div class="stat-head"><span class="tile">${icon("wallet")}</span><span>Total balance</span></div>
          <div class="stat-value stat-value--hero num">${formatKES(d.total_balance_minor, { cents: false })}</div>
          <div class="stat-foot">
            <span>Across ${d.accounts.length} ${d.accounts.length === 1 ? "account" : "accounts"}</span>
          </div>
        </div>
      </section>

      <section class="strip" tabindex="0" aria-label="This period">
        ${statCard({
          iconName: "income", label: "Income", basis,
          minor: summary.income_minor, previous: previous?.income_minor, goodWhen: "up",
        })}
        ${statCard({
          iconName: "expense", label: "Expenses", basis,
          minor: summary.expenses_minor, previous: previous?.expenses_minor, goodWhen: "down",
        })}
        ${statCard({
          iconName: "wallet", label: "Saved", basis,
          minor: summary.saved_minor, previous: previous?.saved_minor, goodWhen: "up",
        })}
      </section>

      ${quickActions()}

      <div class="grid-cards">
        ${accountsCard(d.accounts)}
        ${recentCard(d.recent_transactions)}
      </div>
    </div>
  `;
}

function quickActions() {
  // Add, Transfer and Paste SMS need the entry sheet, which arrives in the next batch.
  return html`
    <section class="card" aria-labelledby="qa-title">
      <div class="card-head"><h2 id="qa-title" class="card-title">Quick actions</h2></div>
      <div class="actions">
        <button type="button" class="action" disabled>
          <span class="tile">${icon("plus")}</span><span>Add</span>
        </button>
        <a class="action" href="#scan">
          <span class="tile">${icon("camera")}</span><span>Scan</span>
        </a>
        <button type="button" class="action" disabled>
          <span class="tile">${icon("transfer")}</span><span>Transfer</span>
        </button>
        <button type="button" class="action" disabled>
          <span class="tile">${icon("message")}</span><span>Paste SMS</span>
        </button>
      </div>
    </section>
  `;
}

function accountsCard(accounts) {
  if (accounts.length === 0) {
        return notice({ title: "No accounts yet", body: "Accounts appear here as your transactions come in." });
  }
  return html`
    <section class="card" aria-labelledby="acc-title">
      <div class="card-head"><h2 id="acc-title" class="card-title">Accounts</h2></div>
      <ul class="rows">
        ${accounts.map(
          (a) => html`
            <li class="row">
              <span class="tile">${icon(ACCOUNT_ICONS[a.type] ?? "wallet")}</span>
              <div class="row-main"><span class="row-title">${a.name}</span></div>
              <span class="amount num" data-tone="${a.balance_minor < 0 ? "neg" : ""}">${formatKES(a.balance_minor)}</span>
            </li>
          `,
        )}
      </ul>
    </section>
  `;
}

function recentCard(transactions) {
  return html`
    <section class="card" aria-labelledby="recent-title">
      <div class="card-head">
        <h2 id="recent-title" class="card-title">Recent activity</h2>
        <a class="card-link" href="#ledger">View all</a>
      </div>
      ${transactions.length
        ? html`<ul class="rows">${transactions.map(transactionRow)}</ul>`
        : html`<p class="eyebrow">Nothing recorded in this period yet.</p>`}
    </section>
  `;
}

function reconciliationNotice(reconcileData) {
  const flagged = (reconcileData?.providers || []).filter((p) => Array.isArray(p.mismatches) && p.mismatches.length > 0);
  if (flagged.length === 0) return "";

  const parts = flagged.map((p) => {
    const latest = p.mismatches[p.mismatches.length - 1];
    const count = p.mismatches.length;
    const label = p.provider.toUpperCase();
    return `${label}: ${count} ${count === 1 ? "mismatch" : "mismatches"} (latest delta ${formatKES(latest.delta_minor, { sign: true })})`;
  });

  return notice({
    tone: "warn",
    title: "Balance discrepancy detected",
    body: parts.join(" · "),
  });
}
