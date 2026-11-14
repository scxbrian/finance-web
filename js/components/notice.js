import { html } from "../lib/dom.js";

export function notice({ title, body, tone = "info" }) {
  return html`
    <section class="notice" data-tone="${tone}" role="${tone === "error" ? "alert" : "status"}">
      <h2 class="notice-title">${title}</h2>
      <p class="notice-body">${body}</p>
    </section>
  `;
}

// Turns any thrown value into a message a person can act on.
export function errorNotice(err) {
  if (err?.code === "not_configured") {
    return notice({
      tone: "warn",
      title: "No backend configured",
      body: "Set apiBase in js/config.js, or set useMocks to true to work against sample data.",
    });
  }
  if (err?.name === "ApiError") {
    return notice({ tone: "error", title: "Something went wrong", body: err.message });
  }
  console.error(err);
  return notice({
    tone: "error",
    title: "Something went wrong",
    body: "An unexpected error occurred. The browser console has the details.",
  });
}