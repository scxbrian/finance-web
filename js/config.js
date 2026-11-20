/* The only file you edit to point the app at a backend.
   Nothing here is secret: everything in a static site is public. */
window.FINANCE_CONFIG = {
  // "same-origin": the page's own host forwards /api to the server (see vercel.json). This is
  // the normal, deployed setup. Or a full address such as "http://127.0.0.1:8001" for
  // local development against a tunnelled backend.
  apiBase: "same-origin",

  // Development only, and only honoured on localhost: reads mocks/dev-data.json instead of
  // calling the API. On a deployed site this setting is ignored, so it can never show fake data.
  useMocks: false,
};