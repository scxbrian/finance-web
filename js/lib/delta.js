/* Turns "this period vs the last" into what a stat card needs to show.
   Returns null when there is nothing meaningful to compare against.

   goodWhen says which direction is good news: income going up is good,
   spending going up is not. The arrow shows direction; the tone shows judgement. */

export function describeChange(current, previous, { goodWhen = "up" } = {}) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;

  const ratio = (current - previous) / Math.abs(previous);
  const tenths = Math.round(Math.abs(ratio) * 1000); // percent to one decimal, as an integer

  if (tenths === 0) return { text: "0.0%", glyph: null, tone: "flat", word: "unchanged" };

  const up = ratio > 0;
  return {
    text: `${(tenths / 10).toFixed(1)}%`,
    glyph: up ? "arrow-up" : "arrow-down",
    tone: (goodWhen === "up") === up ? "pos" : "neg",
    word: up ? "up" : "down",
  };
}