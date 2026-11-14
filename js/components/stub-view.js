import { notice } from "./notice.js";
import { setHTML } from "../lib/dom.js";

// Placeholder used by screens that are not built yet. Each real view replaces it.
export function stubView(title, description) {
  return function render(outlet) {
    setHTML(outlet, notice({ title, body: `${description} This screen is built in a later batch.` }));
  };
}