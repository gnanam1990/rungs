# Rungs — UI and UX spec

Follow the `web-app-shipping` skill (`08-reference/skills/web-app-shipping/SKILL.md`) for structure, phone layout, server-decided page mode and Playwright. This file decides how it looks and what it says.

## 1. Theme: the Binance Wallet family, with our own mark
Captured from https://web3.binance.com/agent-id on 2026-11-25 with computed styles. The page is black, type is white, the single loud colour is the wallet yellow, cards are near-black. Rungs uses the same family so it feels native next to the Agent ID page, and it must **not** look like an official Binance product: no Binance logo, no "Binance" in the wordmark, and the footer says "An independent project. Not affiliated with Binance."

```css
:root {
  /* 60: surfaces */
  --bg: #000000;
  --surface: #1a1a1a;
  --surface-2: #222222;
  --line: #333333;
  --line-strong: #3d3d3d;
  /* 30: text */
  --ink: #ffffff;
  --ink-2: #9c9c9c;
  --ink-3: #7d7d7d;
  /* 10: accent */
  --accent: #fcd535;          /* fills: buttons, the active rung */
  --accent-ink: #000000;      /* text on accent */
  --accent-text: #f0b90b;     /* accent used as text on black */
  /* state */
  --good: #28a473;
  --bad: #f6465d;             /* not captured from the page; standard exchange red, check contrast */
  --info: #5f82d3;
  /* shape */
  --r-sm: 6px; --r-btn: 8px; --r-card: 12px; --r-pill: 999px;
  /* type */
  --font: "Inter", "Segoe UI", system-ui, -apple-system, Arial, sans-serif;
  --mono: "JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, monospace;
  --h1: 700 64px/1.15 var(--font);
  --h2: 600 40px/1.2 var(--font);
  --h3: 600 24px/34px var(--font);
  --body: 400 16px/24px var(--font);
  --small: 400 14px/22px var(--font);
  --space: 4px;
}
@media (max-width: 720px) { :root { --h1: 700 40px/1.15 var(--font); --h2: 600 28px/1.2 var(--font); } }
```
- The sponsor's font (BinanceNova) is proprietary. Do not ship it; Inter is the stand-in. Self-host the font files.
- Primary button: `--accent` fill, `--accent-ink` text, weight 500, height 48px, padding 0 20px, radius `--r-btn`. Small button: 36px, radius 6px. Secondary: `--line-strong` fill, white text. Tertiary: 1px `--accent-text` outline, pill radius (as the page's "Feedback" button).
- Cards: `--surface`, 1px `--line`, radius `--r-card`, padding 20px (16px on phones).
- Accent words inside a white headline use `--accent-text` (as "onchain identity" on the Agent ID page).
- One accent only. Green and red are for outcomes, never decoration.
- Numbers and addresses use `--mono` with `font-variant-numeric: tabular-nums`.

## 2. The mark and the signature element
Wordmark: "Rungs" in Inter 700 with a small ladder glyph (two uprights, three rungs) drawn in SVG, yellow on black. The signature element is **the ladder itself**: seven horizontal bars, widths growing with the limit, the holder's rung filled yellow, rungs below it outlined in yellow, rungs above in `--line`. It appears large on `/line/:address` and small in the header of every page that knows an address.

## 3. Screens
### 3.1 `/` Home
1. Header: mark, links (Ladder, Vouch, Open books, For agents), a single address field "Open my line" (accepts an address only).
2. Hero: "Your name can borrow." / second line in accent text: "Start at 1 USDT." Sub-line: "Hold an Agent ID? Borrow a little, repay on time, and your limit climbs. No collateral. Your record stays on your name."
3. Live strip from `/v1/stats`: holders with a line · loans repaid on time · written off · in the pool now. Each number links to `/open`.
4. "How it works" in three cards: Open · Borrow and repay · Climb. Each card ends with the one command or prompt involved.
5. "What it costs": the fee table with a worked example for 1, 10 and 50 USDT.
6. "What can go wrong": plain list (late fee, write-off, permanent default mark, stake at risk, unaudited contract).
7. Footer: risk notice, independence line, contract links, repo link.

### 3.2 `/line/:address` Standing
- Top: handle as `name.ai` (escaped) with the shortened address beside it and a copy button.
- The ladder element with the current rung, limit in large type, "+ N vouched" if any.
- **Next step card** (one, decided by the API's `nextStep`):
  - `open` — "Open your line" + prompt.
  - `draw` — amount stepper bounded by the limit, live fee and total, due date; then the prompt.
  - `repay` — "You owe 1.01 USDT by Tue 2 Dec, 14:05 (your time)" with a countdown; two-step prompt (approve exact, then repay); a "someone else can pay this for you" link.
  - `repay` when late — the same in `--bad`, showing the late fee and the write-off time.
  - `cure` — what is owed, and that the line restarts at rung 0 with the default mark kept.
  - `wait` — "Repaid early. Loans held under 24 hours do not count towards the next rung."
- Record: repaid on time, late, defaults, progress to the next rung ("1 of 2 on-time repayments").
- History: one line per event in plain words, each linking to the transaction.
- Vouches received and given.
States: loading (skeleton ladder), address has no Agent ID ("This address does not hold an Agent ID. Claim one in the Binance App: Wallet → Agent ID."), no line yet, API down ("Showing nothing rather than guessing. The contract is still available: see For agents."), blocked region, paused.

### 3.3 `/ladder` Rules
The seven rungs as the ladder element with limits; the four outcomes with examples; probation after a default; the 24-hour rule and why it exists ("so nobody can climb by looping").

### 3.4 `/vouch`
What a stake does, the loss order as a three-step diagram, limits (rung 2+, three people, +50 total). Two paths: "through your agent" (prompt) and "from a normal wallet" (injected wallet connect; exact-amount approval; shown only when a wallet is detected).

### 3.5 `/open` Open books
Contracts with BscScan links and "verified" state; the owner address; **every owner permission** in a table (what, limit, delay), taken from `OWNER-PERMISSIONS.md`; caps now and any queued raise with its time; pool numbers; loss by rung; the list of evidence transactions; what is not proven.

### 3.6 `/agents` For agents
Three steps for a human: turn on Developer Mode (where, the 7-day window, its own daily limit), install or open the wallet skill, paste the prompt. Then for the agent: link to `/llms.txt`, `/skill.md`, the action API, the contract ABI.

## 4. Components
Button (primary, secondary, tertiary, each with disabled and busy), AddressField (validates, rejects names with "Enter a wallet address. Rungs does not look up names."), Ladder, StatTile, NextStepCard, PromptBlock (monospace, copy button whose label changes to "Copied" for 2 seconds, a "what this does" line above it), Countdown, OutcomeBadge (Promoted, On time, Early, Small, Late, Cured, Written off), EventRow, Notice (risk, info, error), PermissionTable, Skeleton.

## 5. Phone rules
- Nothing wider than the viewport. Prompt blocks scroll inside themselves (`overflow-x: auto`), never the page.
- The header's links collapse into a bar that scrolls inside itself; items `white-space: nowrap; flex-shrink: 0`.
- The ladder element scales by width, bars never below 28px high; tap targets 44px.
- The next-step card is first on the screen after the handle.

## 6. Microcopy
- Risk notice (fixed text): "Rungs is an experimental, unaudited lending pilot. You can lose money you stake. Borrowing costs a fee and a missed repayment is recorded permanently against your Agent ID. Nothing here is financial advice or a promise of any return."
- Draw confirm line: "Borrow {amount} USDT. Repay {total} USDT by {date}. Late adds {lateFee} USDT. After {writeOffDate} the loan is written off and marked on your name."
- Approve line: "This approval is for exactly {due} USDT, for this one repayment."
- Never: "free", "earn", "yield", "APY", "passive", "guaranteed", "risk-free", "instant cash".
- Dates in the visitor's timezone with the UTC time in a tooltip. Amounts with up to 2 decimals, more only when needed to be exact.

## 7. Motion and accessibility
- Motion: the filled rung slides up once on promotion (300ms, ease-out); number changes cross-fade. Respect `prefers-reduced-motion`.
- Contrast: yellow on black and black on yellow both pass AA; `--ink-3` only for non-essential text at 14px or larger.
- Every state has text, not only colour. Focus ring: 2px `--accent-text`, 2px offset.
- Language: English first. Strings live in one file so Bahasa Indonesia and Chinese can be added (many holders in the feed write in those languages); translated labels must be tested at phone width.
