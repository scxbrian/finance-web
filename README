# senti-web

The frontend of **Senti**, a personal finance tracker for Kenyan shillings: a
ledger of income, spending and transfers across M-Pesa, bank and cash, with
receipt scanning and monthly analysis. It is written in plain HTML, CSS and
JavaScript with no framework and no build step, and it talks to a separate API.

The backend lives in its own repository: `senti-api`.

**Status:** live and connected to `senti-api`. The responsive shell, light/dark
theme boot, session-cookie sign-in, Senti branding (`sentisvg.svg`), and core
views (`Home`, `Ledger`, `Scan`, `Insights`, `Scores`) are deployed on Vercel.

## Contents

1. How it works
2. Repository layout
3. Running it locally
4. Configuration
5. The API contract
6. Design decisions
7. Trade-offs and known limitations
8. Deploying to Vercel
9. Testing checklist
10. Roadmap

## How it works

The app is one HTML page, `index.html`, that holds only the shell: navigation,
a header and an empty content area. A small hash router watches the address bar
(`#ledger`, `#insights`) and renders the matching view into that content area.
Each view is its own JavaScript module that asks the API for data, builds its
markup, and attaches its event handlers.

    browser
      |
      |-- static files (Vercel): index.html, css/, js/
      |
      `-- fetch /api/... --> senti-api (self-hosted, behind HTTPS)

Every request goes through one module, `js/api/client.js`. Views never call
`fetch` themselves, so base URL, credentials, timeouts and error handling live
in exactly one place.

## Repository layout

    senti-web/
    ├── index.html           # app shell only
    ├── css/
    │   ├── tokens.css       # colours, type scale, spacing, both themes
    │   ├── base.css         # reset, typography, form controls
    │   ├── layout.css       # shell, sidebar, mobile bottom bar, topbar logo
    │   ├── components.css   # buttons, cards, sheet, toast, rows
    │   └── views/           # one stylesheet per screen
    ├── js/
    │   ├── theme-boot.js    # sets the theme before first paint
    │   ├── config.js        # backend address, the only setting
    │   ├── main.js          # boot
    │   ├── router.js        # hash routing
    │   ├── state.js         # small shared store
    │   ├── api/             # client.js plus one module per API area
    │   ├── lib/             # money, dates, DOM helpers, image resizing
    │   ├── components/      # sheet, toast, charts, shared pieces
    │   └── views/           # one module per screen
    ├── mocks/               # development data, never loaded in production
    ├── assets/
    │   ├── fonts/           # self-hosted Manrope font
    │   ├── icons.svg        # icon sprite
    │   └── sentisvg.svg     # Senti ribbon brand mark and favicon
    ├── docs/
    │   └── api-contract.md  # the agreement with senti-api
    └── README.md

## Running it locally

There is nothing to install. Browsers refuse to load ES modules from `file://`,
so use any static server from the repository root:

    python -m http.server 5500

Then open `http://localhost:5500`.

## Configuration

One file, `js/config.js`:

| Setting     | Meaning                                                              |
| ----------- | -------------------------------------------------------------------- |
| `apiBase`   | Public HTTPS address of `senti-api`, no trailing slash.              |
| `useMocks`  | `true` reads `mocks/dev-data.json` instead of calling the API.       |

With `apiBase` empty and `useMocks` false, the app reports that no backend is
configured. It never substitutes fake data on its own.

Nothing in this file is secret. Everything in a static site is public, so
credentials of any kind belong on the server.

## The API contract

`docs/api-contract.md` lists every endpoint the frontend uses, with the exact
request and response shapes. The two repositories are separate, so this document
is the agreement between them. If a response shape changes, the contract and
the code on both sides change together.

## Design decisions

### Plain HTML, CSS and JavaScript

The interface has several screens and a lot of changing data, which is where
frameworks earn their keep. They also bring a build step, a dependency tree and
a toolchain that has to be maintained. For a single-user tool that should still
build in five years, I chose to give up reusable components and keep the
simplicity. The cost is discipline: one module per screen, one API client, and
no logic buried in the HTML.

### ES modules

The portfolio site uses classic scripts because it is one small file. This app
has dozens of files, and a single global script does not scale to that.
ES modules give real imports and exports with no bundler. They need a static
server locally, which is already part of the workflow, and they load normally
from Vercel.

### Hash routing

Routes look like `#ledger`. The browser never asks the server for a path that
does not exist, so Vercel needs no rewrite rules, and refreshing a page always
works.

### No silent demo mode

An earlier prototype fell back to fake data whenever the API failed. In a
finance app that is dangerous: it can make an unsaved transaction look saved.
Mock data now exists only as an explicit development switch.

### Money is never a float

Amounts travel between frontend and API as integers in minor units (cents), and
user input is parsed from text, never multiplied as a floating-point number.
Formatting for display happens in one function, `js/lib/money.js`.

### Outside data is untrusted

Anything that originated outside the app, such as a merchant name read from a
receipt or the text of an SMS, is inserted into the page as text, never as HTML.
This closes off a whole class of injection problems at almost no cost.

### Theme before paint

`theme-boot.js` is a tiny blocking script in the head. Without it a dark-mode
phone would flash white on every load.

## Trade-offs and known limitations

- No components means some markup is built as template strings in JavaScript.
- No type checking and no build means mistakes surface at runtime, so the
  testing checklist matters.
- The app depends on a self-hosted API. When the server is down the app says
  so, and writes made while offline are queued rather than lost (planned).

## Deploying to Vercel

1. Import `scxbrian/senti-web` as a project on Vercel.
2. Set the framework preset to **Other** and leave the build command and output
   directory empty.
3. Deploy. Pushes to `main` publish to production; other branches get preview
   URLs.

The API must be reachable over HTTPS, because an HTTPS page cannot call an
HTTP address. File names are case-sensitive on Vercel, so links must match file
names exactly.

## Testing checklist

- [x] Renders correctly at about 375 px wide, with the Senti logo in the mobile topbar and desktop sidebar.
- [x] Both themes look right, with no flash on load.
- [x] Every navigation link opens its view and focus moves to the content.
- [x] Sign-in and session cookies work cross-origin against `senti-api`.
- [ ] With the API unreachable, an honest error is shown, not stale or fake data.
- [ ] The whole app works from the keyboard alone.
- [ ] No errors in the browser console on a normal load.

## Roadmap

- [x] Core views (`Home`, `Ledger`, `Scan`, `Insights`, `Scores`) connected to `senti-api`.
- [x] Senti brand identity (`sentisvg.svg`) across favicon, mobile topbar, and desktop rail.
- [ ] First-run welcome / onboarding state and phone SMS forwarder setup guide.
- [ ] Interactive manual entry, transfer, and paste-SMS sheets.
- [ ] Balance mismatch flags from reported M-Pesa balances.
- [ ] Receipt scan and review flow.
- [ ] Installable app (manifest and service worker) with an offline write queue.