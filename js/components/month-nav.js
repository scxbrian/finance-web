import { html, setHTML } from "../lib/dom.js";
import { currentMonth, formatMonth, shiftMonth } from "../lib/dates.js";
import { getState, setState, subscribe } from "../state.js";
import { icon } from "./icon.js";

/* The previous / next month control in the top bar. It only changes the shared month; the
   router re-renders the current screen when that happens. Returns a cleanup function. */
export function mountMonthNav(el) {
  const paint = ({ month }) => {
    const atLatest = month >= currentMonth(); // "YYYY-MM" strings sort in date order
    setHTML(
      el,
      html`
        <div class="month-nav" role="group" aria-label="Month">
          <button type="button" class="icon-btn" data-step="-1" aria-label="Previous month">${icon("chevron-left")}</button>
          <span class="month-label" aria-live="polite">${formatMonth(month)}</span>
          <button type="button" class="icon-btn" data-step="1" aria-label="Next month" ${atLatest ? "disabled" : ""}>${icon("chevron-right")}</button>
        </div>
      `,
    );
  };

  const onClick = (event) => {
    const button = event.target.closest("[data-step]");
    if (!button || button.disabled) return;
    setState({ month: shiftMonth(getState().month, Number(button.dataset.step)) });
  };

  paint(getState());
  el.addEventListener("click", onClick);
  const unsubscribe = subscribe((state, changed) => {
    if (changed.includes("month")) paint(state);
  });

  return () => {
    el.removeEventListener("click", onClick);
    unsubscribe();
    el.textContent = "";
  };
}