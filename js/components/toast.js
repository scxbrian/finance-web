let timer;

// A short message at the bottom of the screen, for failures with nowhere else to go.
export function showToast(message, { ms = 4000 } = {}) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  clearTimeout(timer);
  timer = setTimeout(() => {
    el.hidden = true;
  }, ms);
}