# M07 — Web app

## Skill to load first
Load the owner's **`web-app-shipping`** skill and follow it (copy at `08-reference/skills/web-app-shipping/SKILL.md`). Colours, type, screens and copy come from `04-UIUX-SPEC.md`.

## Goal
The six routes in the UI spec, correct on a phone, with page mode decided by the server.

## Files
```
apps/web/index.html
apps/web/src/main.tsx, App.tsx, router.ts
apps/web/src/styles.css            the only stylesheet; tokens from the UI spec
apps/web/src/api.ts                typed fetchers for the keeper; no other network calls
apps/web/src/strings.ts            every user-facing string
apps/web/src/pages/{Home,Line,Ladder,Vouch,Open,Agents}.tsx
apps/web/src/components/*          as listed in the UI spec
apps/web/public/fonts/*            self-hosted Inter and JetBrains Mono
apps/web/e2e/*.spec.ts             Playwright, API mocked
```

## Rules
- React + Vite, no Tailwind, no UI kit. `lucide-react` for icons.
- No sign-in of any kind. No cookies. `localStorage` only for the last viewed address and a dismissed notice, in try/catch.
- The app asks `GET /v1/public/site` first and renders the mode it returns.
- Every command shown comes from the API response, unchanged.
- The optional injected-wallet path on `/vouch` uses viem's wallet client directly, requests only `eth_requestAccounts`, `eth_chainId`, `wallet_switchEthereumChain` and `eth_sendTransaction`, and approves exact amounts. It is hidden when no provider is present.
- Escape handles; never use `dangerouslySetInnerHTML`.
- Tests use roles and labels and assert what was shown and copied. A click that times out on the phone project is a layout bug; never use `force: true`.
- Content-Security-Policy: `default-src 'self'`; `connect-src` the keeper origin and the RPC used by the wallet path; no inline scripts.

## Tests first
T-W01 … T-W12.

## Definition of Done
- [ ] All listed tests pass on both Playwright projects
- [ ] Lighthouse on the phone profile: performance ≥ 90, accessibility ≥ 95
- [ ] Screenshots of every route and every `/line` state at 390px and 1440px in the pull request
- [ ] Deployed ([HUMAN] picks host and domain; the domain contains neither "binance" nor "bnb"); the live site shows the owner's real line
- [ ] [HUMAN] "List Your dApp" application sent

## Ship it
Branch `m07-web-app` → local checks + `pnpm e2e` → pull request with screenshots → checks green → self-review against the UI spec and the red-line map → squash merge.
