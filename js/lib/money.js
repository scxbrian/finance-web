/* Money helpers. Amounts are integers in minor units (cents): 125050 = KES 1,250.50.
   Floats never touch an amount, so sums are always exact. */

const MAX_WHOLE_DIGITS = 12;
const groupFormat = new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 });

// "1,250.50" -> 125050. Returns null for anything that is not a plain amount.
// Works on the text directly, never by multiplying a float by 100.
export function parseKES(input) {
  const text = String(input ?? "")
    .replace(/^\s*(KES|KSH|KSHS)\.?\s*/i, "")
    .replace(/[,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;

  const [whole, fraction = ""] = text.split(".");
  if (whole.length > MAX_WHOLE_DIGITS) return null;
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

// 125050 -> "KES 1,250.50". Options: sign (show "+" on positives), cents (default true).
export function formatKES(minor, { sign = false, cents = true } = {}) {
  if (!Number.isSafeInteger(minor)) return "KES —";

  const abs = Math.abs(minor);
  const units = cents ? Math.trunc(abs / 100) : Math.round(abs / 100);
  const body = `KES ${groupFormat.format(units)}${cents ? "." + String(abs % 100).padStart(2, "0") : ""}`;

  if (minor < 0) return `-${body}`;
  if (sign && minor > 0) return `+${body}`;
  return body;
}