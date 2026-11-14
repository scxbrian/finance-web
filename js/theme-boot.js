/* Runs in <head>, before anything is painted.
   Its only job is to set data-theme so the page never flashes the wrong theme. */
(function () {
  var theme = "light";
  try {
    theme =
      localStorage.getItem("ft-theme") ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  } catch (e) {
    /* Storage can throw in private browsing; fall back to the default. */
  }
  document.documentElement.setAttribute("data-theme", theme);
})();