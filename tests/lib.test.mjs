import test from "node:test";
import assert from "node:assert/strict";

import { esc, html, raw, setHTML } from "../js/lib/dom.js";
import { parseKES, formatKES } from "../js/lib/money.js";
import { currentMonth, shiftMonth, formatMonth, todayISO, formatDayLong } from "../js/lib/dates.js";
import { describeChange } from "../js/lib/delta.js";

test("html`` escapes every interpolated value unless it is marked safe", () => {
  const evil = `<img src=x onerror="alert(1)">`;
  assert.equal(String(html`<p>${evil}</p>`), "<p>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</p>");
  assert.equal(String(html`<p>${raw("<b>ok</b>")}</p>`), "<p><b>ok</b></p>");
  assert.equal(String(html`<ul>${["a", "<b>"].map((x) => html`<li>${x}</li>`)}</ul>`), "<ul><li>a</li><li>&lt;b&gt;</li></ul>");
  assert.equal(String(html`${false}${null}${undefined}${0}`), "0");
  assert.equal(esc(`'"&<>`), "&#39;&quot;&amp;&lt;&gt;");
});

test("setHTML refuses a plain string", () => {
  assert.throws(() => setHTML({}, "<p>x</p>"), TypeError);
  const el = {};
  setHTML(el, html`<p>x</p>`);
  assert.equal(el.innerHTML, "<p>x</p>");
});

test("parseKES reads amounts as exact integers of cents", () => {
  assert.equal(parseKES("1,250.50"), 125050);
  assert.equal(parseKES("KES 100"), 10000);
  assert.equal(parseKES("1.005"), null); // never rounds a third decimal
  assert.equal(parseKES("1.1"), 110);
  for (const bad of ["", ".5", "12.345", "1e3", "-5", "abc", "9".repeat(13)]) assert.equal(parseKES(bad), null, bad);
});

test("formatKES is exact, signed and grouped", () => {
  assert.equal(formatKES(125050), "KES 1,250.50");
  assert.equal(formatKES(-234000), "-KES 2,340.00");
  assert.equal(formatKES(5, { sign: true }), "+KES 0.05");
  assert.equal(formatKES(14695000, { cents: false }), "KES 146,950");
  assert.equal(formatKES(NaN), "KES —");
});

test("month arithmetic crosses years both ways", () => {
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(shiftMonth("2026-11", -11), "2025-12");
  assert.equal(formatMonth("2026-11"), "November 2026");
});

test("dates use the local calendar, never UTC", () => {
  // 01:30 local on the 16th must still be the 16th, whatever UTC says.
  assert.equal(todayISO(new Date(2026, 10, 16, 1, 30)), "2026-11-16");
  assert.equal(currentMonth(new Date(2026, 10, 30, 23, 59)), "2026-11");
  assert.match(formatDayLong("2026-11-14"), /Sat.*14.*Nov/);
});

test("describeChange separates direction from whether it is good news", () => {
  assert.deepEqual(describeChange(3_124_000, 3_680_000, { goodWhen: "down" }), {
    text: "15.1%", glyph: "arrow-down", tone: "pos", word: "down",
  });
  assert.equal(describeChange(110, 100, { goodWhen: "down" }).tone, "neg");
  assert.equal(describeChange(100, 0), null);
  assert.equal(describeChange(100, 100).tone, "flat");
});