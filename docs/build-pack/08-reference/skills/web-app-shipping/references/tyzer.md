# Tyzer web app: where things are

Repo: `C:\Users\Gnanam\Documents\arcrelay` (pnpm monorepo). Live site: https://tyzer.app on Render. The repo's `AGENTS.md` and `CONTRIBUTING.md` rules come first: money is bigint, chat text never authorizes money, and you stop at every external-action boundary.

## Frontend

- `apps/web/src/` holds the React app, served at `/me` (and `/app/`), built to `apps/web/dist`:
  - `App.tsx`: shell, rail + bottom `tabbar`, views;
  - `Welcome.tsx`: signed-out card with faces `soon` | `signin` | `create` | `username` | `done`;
  - `Move.tsx`: domain-move banner and move-code panel (DR-0041/0046/0047);
  - `SendSheet.tsx`: who + amount keypad, held-payment hint;
  - `Profile.tsx`: tabs Profile / Wallet / Chats & people / Agents;
  - `Activity.tsx`: payment list with filter tabs;
  - `lib.ts`: `api()` helper and typed endpoint wrappers;
  - `i18n.ts`: `t()` strings (Tamil included);
  - `styles.css`: tokens and components (`.tabs`, `.tab`, `.welcome-*`, `.move-panel`).
- `apps/web/e2e/` has `app.spec.ts` and `mock-api.ts` (`mockApi`, `ME`, `fakePasskey`, `useLanguage`). `apps/web/playwright.config.ts` defines the desktop and phone projects.
- Old server-rendered pages live in `apps/api/src/pages.ts` (`cspFor`, `newNonce`) and `apps/api/src/web/*.js`. Standalone pages such as `/email-link` are inline in `apps/api/src/me-routes.ts`.

## Server pieces the UI depends on

- `apps/api/src/me-routes.ts`:
  - `/v1/me`, which carries `move.onOldHost` (decided from Host on GET; see `pageOnOldHost`);
  - `/v1/public/site`, `/v1/public/wallet-setup`, `/v1/public/waitlist`;
  - `/v1/me/send`, `/v1/me/move/preview` (returns `sendNowMinor`, `newUsername`, `openPayments`);
  - `/v1/email-invites/redeem`.
- `apps/api/src/config.ts` holds the env flags: `SITE_COMING_SOON`, `WEB_WALLET_DAILY_CAP`, `EMAIL_PROVIDER`.
- `apps/api/src/server.ts` has the old-host redirect hook: every host except the new one counts as old.

## Commands (run in the live checkout; deep scratch paths break vitest on Windows)

```
pnpm typecheck
pnpm lint
pnpm exec prettier --check <files>
pnpm vitest run apps/api packages            # API/domain on real disposable PostgreSQL
pnpm --filter @arcrelay/web run build
pnpm exec playwright test -c apps/web/playwright.config.ts
pnpm exec playwright install chromium        # once per machine
pnpm dev:local                               # isolated local stack: anvil, random keys, outbox email, localhost:8790
```

`pnpm dev:local` is safe because it never touches `.env` or the live relayer key. Never start the real local server (`pnpm start` with `.env`): two servers with one relayer key would mean nonce clashes.

## Deploy notes

- Render service `tyzer`. Deploys are manual ("Manual Deploy → Deploy latest commit"), except that a pushed `render.yaml` change syncs the Blueprint and deploys at once.
- Before any deploy, check nothing is in flight: in the Render Shell, count `economic_actions` and `payment_intents` by state. There must be nothing in SUBMITTING/UNKNOWN or in flight.
- After a deploy:
  - the new instance logs `sender_lease_acquired`; with DR-0048 the old one logs `sender_handover` within seconds;
  - verify the live bundle with `curl https://tyzer.app/me`, then grep the `/app/assets/*.js` or `*.css` asset.
