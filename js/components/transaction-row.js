import { html } from "../lib/dom.js";
import { formatKES } from "../lib/money.js";
import { formatDay } from "../lib/dates.js";
import { icon } from "./icon.js";

/* sign: income adds to net worth, expense subtracts, a transfer is neutral. An unknown kind
   from a newer backend gets the neutral treatment rather than being shown as spending, so a
   surprise never misreports money. */
const KINDS = {
  income: { glyph: "income", sign: 1 },
  expense: { glyph: "expense", sign: -1 },
  fee: { glyph: "expense", sign: -1 },
  transfer: { glyph: "transfer", sign: 0 },
  opening: { glyph: "wallet", sign: 0 },
  adjustment: { glyph: "list", sign: 0 },
};
const UNKNOWN = { glyph: "list", sign: 0 };

export function transactionRow(tx) {
  const kind = KINDS[tx.kind] ?? UNKNOWN;
  const amount =
    kind.sign === 0 ? formatKES(tx.amount_minor) : formatKES(kind.sign * tx.amount_minor, { sign: true });

  const where =
    tx.kind === "transfer" && tx.to_account
      ? `${tx.account.name} to ${tx.to_account.name}`
      : [tx.category, tx.account.name].filter(Boolean).join(" · ");
  const feeNote = tx.fee_minor ? ` · incl. ${formatKES(tx.fee_minor)} fee` : "";

  return html`
    <li class="row">
      <span class="tile">${icon(kind.glyph)}</span>
      <div class="row-main">
        <span class="row-title">${tx.title}</span>
        <span class="row-meta">${where} · ${formatDay(tx.occurred_on)}${feeNote}</span>
      </div>
      <span class="amount num" data-tone="${kind.sign > 0 ? "pos" : ""}">${amount}</span>
    </li>
  `;
}