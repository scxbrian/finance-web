/* Theme toggle. The storage key matches js/theme-boot.js. */

const KEY = "ft-theme";

// Keeps the browser's address-bar colour in step with the page background.
function syncThemeColor() {
  const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
  if (bg) document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bg);
}

export function initTheme(button) {
  syncThemeColor();
  button.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* private browsing; the choice just won't persist */
    }
    syncThemeColor();
  });
}