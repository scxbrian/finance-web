import { html, setHTML } from "../lib/dom.js";
import { signIn } from "../api/auth.js";
import { setState } from "../state.js";

// What to tell a person when signing in fails. The server's own wording is used for wrong
// passwords and lockouts, because it is written to be safe to show.
export function failureMessage(err) {
  if (err?.code === "network") return "Can't reach the server. Check your connection and try again.";
  if (err?.code === "timeout") return "The server took too long to respond. Try again.";
  if (err?.code === "not_configured") return "No backend is configured for this site.";
  return err?.message || "Something went wrong. Try again.";
}

export function render(outlet) {
  setHTML(
    outlet,
    html`
      <section class="login-card" aria-labelledby="login-title">
        <h1 id="login-title">Sign in</h1>
        <form id="login-form" class="stack" novalidate>
          <label class="field">
            <span>Email</span>
            <input class="input" name="email" type="email" autocomplete="username" inputmode="email"
                   autocapitalize="none" spellcheck="false" required>
          </label>
          <label class="field">
            <span>Password</span>
            <input class="input" name="password" type="password" autocomplete="current-password" required>
          </label>
          <p id="login-error" class="form-error" role="alert" hidden></p>
          <button type="submit" class="btn btn-primary btn-block">Sign in</button>
        </form>
      </section>
    `,
  );

  const form = outlet.querySelector("#login-form");
  const errorEl = outlet.querySelector("#login-error");
  const button = form.querySelector("button");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    if (!email || !password) {
      errorEl.textContent = "Enter your email and password.";
      errorEl.hidden = false;
      return;
    }

    errorEl.hidden = true;
    button.disabled = true;
    try {
      // Setting the user is all that is needed: the router sees it and moves on to Home.
      setState({ user: await signIn(email, password) });
    } catch (err) {
      errorEl.textContent = failureMessage(err);
      errorEl.hidden = false;
      form.elements.password.value = "";
      form.elements.password.focus();
    } finally {
      button.disabled = false;
    }
  });

  outlet.querySelector("input[name=email]").focus();
}