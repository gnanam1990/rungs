---
name: web-app-shipping
description: Playbook for building, fixing and shipping the frontend of a real web app (React + Vite + CSS tokens, passkey sign-in, a server API), learned on the Tyzer payments app. Use it whenever you add or change a page, form, banner, tab bar, landing or "coming soon" page, sign-in or passkey flow, email or waitlist form, or translated UI; whenever a mobile layout breaks, a Playwright click times out, a page shows the wrong state on one domain, or the UI must reflect server limits; and before deploying a frontend change. It covers phone-width layout, server-driven page modes, consent-first data forms, Origin/Host pitfalls, CSP-nonce pages that carry secrets in the URL fragment, flows sized to server limits, passkey UX, long translated labels, Playwright e2e patterns and checking the live result. For colours and visual style, use palette-60-30-10 alongside it.
---

# Web app shipping playbook

Practical rules from shipping the Tyzer web app (React + motion/react + lucide-react, Vite, one `styles.css` of tokens, Playwright e2e on desktop and phone with a mocked API). Every rule below came from a real bug or a real request. Each explains why, so you can apply it to apps that look different.

For colour, theme and visual motifs, also load the **palette-60-30-10** skill. For the Tyzer repo's file map and commands, read `references/tyzer.md`. For debug snippets (overflow finder, hit-test probe, live-bundle checks), read `references/debug-snippets.md`.

## 1. Phone width is the real test

Most layout bugs only show on a phone. The worst one is a page that is a few pixels wider than the screen. The phone then zooms the whole layout out, so everything looks fine but taps land somewhere else. In Playwright this shows up as `<div …> intercepts pointer events` on a fixed bottom bar. In the page, `window.innerWidth` grows, for example from 412 to 518.

- **Rows of tabs, chips and segments must scroll inside their own bar, never widen the page.** On the container: `max-width: 100%; overflow-x: auto; scrollbar-width: none` (plus `::-webkit-scrollbar { display: none }`). On each item: `white-space: nowrap; flex-shrink: 0`. One variant of the row may already have this while the shared base class does not, so fix the base class.
- **Translated labels are longer.** Tamil, German and Malayalam can be twice the English width. Test the longest language you ship, on the phone size.
- **Assert it in tests** on every new screen, in both projects. Compare with the viewport the test set, not with `innerWidth`. On a phone (mobile emulation), a too-wide page is zoomed out, so `innerWidth` grows with `scrollWidth` and `scrollWidth - innerWidth` stays 0 even when the page is broken. This was measured: 636 vs 636 with a 412 px viewport.

  ```ts
  async function expectNoSidewaysScroll(page: Page) {
    const width = page.viewportSize()!.width;
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
  ```

  Prove a new check can fail: once, inject a wide element (`div` with `width: 620px`) in a throw-away spec and watch it go red on the phone project.

- **When a click "times out" on a phone only, don't add `force: true`.** Find the element wider than the screen (see `references/debug-snippets.md`) and fix the CSS. A forced click hides a bug real users will hit.

## 2. Let the server decide the page's mode

Page modes such as "Coming soon", a feature switch, or holding off on wallet creation come from a server flag (for example `GET /v1/public/site` → `{ comingSoon: true }`). They should not come from a build-time constant. Flipping the flag at launch is then an env change, with no code or design work.

- **Wait for the flag before revealing the card.** A screen that renders "Sign in", then flips to "Coming soon", looks broken. Hold the opening animation until the flag has arrived, and treat a failed fetch as the safe default.
- **Gate only the front door.** Leave alone every route that existing users or integrations depend on: approve pages, pay links, webhooks, signed-in pages, old-domain pages during a move. Before you ship, list which routes stay live and test one of them.
- **Hide a capability behind a small link, and keep it reachable.** For example "Already have a wallet? Sign in" with a Back link. Existing users keep working while newcomers see the new message.
- **Stop the backend too.** If the page hides "Create a wallet", the API should also refuse it (a daily cap of 0). Hiding a button is not access control.
- **Say only what is true.** For example: "finishing the build and a security audit, then going live on mainnet". Don't promise dates or claims the owner hasn't made.

## 3. Forms that collect personal data

A waitlist email, or anything else that identifies a person:

- **Collect the minimum** (email only, not a wallet address, if email is enough to reach them), and say why in one line.
- **Ask for consent explicitly**: an unticked checkbox whose text says what will happen and how long the data is kept, for example "Email me once when X launches. We keep only this address, encrypted, and delete it within a year." Keep submit disabled until the input is valid and the box is ticked.
- **Give the same answer whether or not the person was already on the list**, so the form doesn't reveal who signed up.
- **On the server:** accept the request only from the site's own Origin, apply one server-wide rate limit (behind a proxy, per-IP limits see one IP), cap the total, store the data encrypted with a keyed digest for de-duplication, and purge it on a schedule. Give the owner export and delete commands.
- **Show a clear success state** ("You are on the list"), not just a cleared field.
- **Never type a real person's data into the form yourself** to test it. Use test values in automated tests, and let the owner try it with their own address.

## 4. Origin and Host: what a page load really sends

- **A same-origin GET carries no `Origin` header.** Fetch adds Origin to POST and cross-origin requests, not to a plain GET. Server code that decides UI state ("are we on the old domain?") from `Origin` gets it wrong on every page load. One real bug: the new domain showed the old domain's banner and hid the button the user needed.
  - For display-only decisions on GET, use the `Host` header, or decide in the client from `location.origin`.
  - For anything that changes state, keep the strict Origin check.
- **Behind a tunnel or proxy that rewrites `Host`** (ngrok `--host-header=rewrite`, Render's internal hostname), the old domain arrives as the server's own name. So "everything that is not the new host counts as old" is the robust rule.
- **Test page loads the way a browser sends them**: the Host header and no Origin. A test that sends `origin:` on a GET hides this bug.

## 5. Standalone pages that carry a secret

Some pages need no app: an emailed claim link, a magic link, a hand-off page.

- **Put the token in the URL fragment** (`/email-link#k=<token>`). Fragments never reach the server or its logs.
- **The page script** reads it, removes it with `history.replaceState(null, "", location.pathname)`, POSTs it to the API, then calls `location.replace(nextUrl)`. Show a plain message for each failure: incomplete link, expired, or network error.
- **Serve the page with a per-request CSP nonce** (`script-src 'nonce-…'`, `connect-src 'self'`), `cache-control: no-store` and `<meta name="referrer" content="no-referrer">`.
- **On the server**, store only a digest of the token, accept it only while the thing it unlocks is open, and return the next URL (with its own short-lived credential) instead of acting on GET.

## 6. Flows that must fit server limits

When a button triggers an action the server may refuse (payment limits, quotas, caps):

- **The server computes the allowed amount** and returns it with the preview (for example `sendNowMinor`). The UI fills in that amount. Never hard-code the limit in the frontend: the policy changes, and the UI would drift from it.
- **If only part fits, say so and label the button honestly**: "Send 25 of 40 USDC now", with a line saying to press Check again for the rest once it arrives. If nothing fits now, explain that instead of showing a dead button.
- **Surface blockers before irreversible steps.** If open items (pending refunds) will block the final step, show that at the start, not after the user has already moved money.
- **The server still re-checks at approval.** The UI's number is a convenience, never the authorization.

## 7. Passkey UX

- **Passkeys are bound to the domain (RP ID) they were made on.** A move to a new domain means a new passkey there plus a migration step, because old passkeys never work on the new domain. Plan the UI for both sides of a move.
- **Where the passkey lives matters.** A Google Password Manager passkey on Windows may not appear in Windows Hello's dialog: tell users to choose "Use a different passkey" → Google Password Manager. Local-dev passkeys (`localhost`) pile up across reset databases: tell testers to pick the newest one.
- **Sessions expire** (for example after 30 minutes). Make re-sign-in obvious, and expect it after a deploy or restart.
- **Copy:** name the device action ("Approve with your passkey"), never ask for passwords, and state the safety facts plainly, for example "X never asks for a password, a recovery phrase or a card number."
- **Never complete a passkey prompt, PIN or password for the user**, even when you are driving the browser. Open the page, then ask them to do that step.

## 8. Public links and trust

- **Official-account links help users avoid scams** on pages where money moves (pay pages: "pay only through the official X"). Removing them from a marketing page is fine; keep them where people pay.
- **Don't display handles you don't own yet.** Buy the handle first.

## 9. Testing: Playwright e2e against a mocked API

- **Run two projects, desktop and phone**, for every test.
- **Use one mock helper.** It records every call and answers 404 for unknown `/v1` paths, so a missing mock fails loudly. Override per test: `mockApi(page, { "GET /v1/public/site": { comingSoon: true }, "POST /v1/x": {...} })`.
- **Assert what was sent**, not only what is shown: `expect(api.calls.find(c => c.path === "/v1/public/waitlist")?.body).toEqual({...})`.
- **Navigation helper:** the side rail and the bottom bar both render, so pick the visible one with `getByRole("button", { name, exact: true }).filter({ visible: true }).first()`.
- **Prefer roles and labels** (`getByRole`, `getByLabel`) over CSS selectors. They double as an accessibility check.
- **Build the web bundle before e2e.** Tests run against the built app, and a stale bundle gives false results. If browsers are missing: `pnpm exec playwright install chromium`.
- **A failing test may be older than your change.** Check out the commit before it, rebuild and rerun the single test. If it fails there too, say so and fix it as its own change.
- **Throw-away debug specs** (probing layout from inside the page) are fine. Delete them before committing.
- **Server routes that pages call** get API tests too: origin checks, validation, the same answer for duplicates, and the data being stored encrypted.

## 10. Before and after deploying a frontend change

- **Run** typecheck, lint, prettier on the changed files, the unit and API tests, and the web e2e (desktop + phone).
- **Know what triggers a deploy.** On some hosts (Render Blueprints) changing `render.yaml` deploys on push even with auto-deploy off. Do any pre-deploy safety check before pushing such a change.
- **Verify the live result, not just the deploy log:**
  - fetch the page, find the hashed JS/CSS asset and grep for the new string or CSS rule;
  - call the public endpoint (for example `/v1/public/site`);
  - take a screenshot of the real page at phone and desktop widths.
- **Report honestly what you checked and what you didn't.** For example: "form is live and guarded; no real sign-up has been made yet".
