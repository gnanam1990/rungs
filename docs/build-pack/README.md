# Rungs — build pack (START HERE)

This folder is everything a coding agent needs to build **Rungs** for the Binance Wallet × BNB Chain **Agent ID Hackathon**. The agent has no other context, so read the files in the order below before writing code.

## The idea in 30 seconds
Rungs is a credit ladder for people who hold a Binance **Agent ID** (`name.ai`, a non-transferable ERC-721 on BNB Chain, one per Binance account).

1. An Agent ID holder opens a line. The first rung is **1 USDT**, with no collateral.
2. They repay within 7 days (principal plus a flat 1% fee). Repaying on time moves them **up one rung**: 1 → 2 → 5 → 10 → 20 → 35 → 50 USDT.
3. Missing the deadline plus grace writes the loan off, sends them back to rung 0, and leaves a **permanent mark on an identity they cannot replace**.
4. A holder in good standing can **vouch** for another holder by staking USDT behind them. The stake raises the other person's limit and is lost first if they default.
5. Other apps read a holder's standing with one view call (`standingOf(address)`).

On-chain lending normally needs more collateral than the loan, because a defaulter just opens a new wallet. A name that is one-per-person and cannot be moved makes a reputation worth keeping. That is the whole pitch: **the Agent ID is the collateral.**

## How to use this pack in a new chat
1. Unzip into the new repo at `docs/build-pack/`.
2. Copy `CLAUDE.md` to the repo root.
3. Paste `06-prompts/00-bootstrap.md` into the chat.
4. Then paste one module prompt at a time, from `06-prompts/M00-repo-and-ci.md` through `06-prompts/M10-traction-demo-submission.md`. Do not start a module before the previous pull request is merged.

## Reading order
| # | File | Why |
|---|---|---|
| 1 | `CLAUDE.md` | Rules for the coding agent |
| 2 | `00-context/01-hackathon-brief.md` | Event facts, judging, red lines, competitors |
| 3 | `00-context/05-feasibility-and-gaps.md` | What is verified, what is not, fallbacks |
| 4 | `00-context/02-sponsor-docs-digest.md` | Exact addresses, ABI, CLI commands, limits |
| 5 | `01-PRD.md` → `02-TDD.md` → `03-TEST-PLAN.md` → `04-UIUX-SPEC.md` | The product and design |
| 6 | `05-modules/` + `06-prompts/` | One module at a time |
| 7 | `07-demo-and-submission/`, `08-reference/` | Demo, submission, day plan, cut list |

`00-context/03-research-evidence.md` and `00-context/04-builder-assets.md` are background; read them when a module points to them.

## Non-negotiables
- **Deterministic code decides money.** Limits, fees, promotions and write-offs come from `LadderLib` and nothing else. No model output ever sets an amount or a recipient.
- **The user confirms every transaction.** Rungs never collects on a schedule, never holds a session, never asks for an unlimited approval. Repayment is a transaction the holder (or anyone paying for them) sends.
- **The hackathon red lines are product requirements** (`00-context/01-hackathon-brief.md` section 5). Breaking one disqualifies the entry.
- **No promise of returns.** The pool is funded by the team treasury. There is no public deposit-to-earn product, and the words "yield", "APY", "passive income" and "earn" do not appear in the product.
- **Not a name lookup tool.** The app shows the connected holder their own line. There is no "search a name, see their wallet" box.
- **Not Binance.** Never use the Binance or BNB name or logo as the product's brand. The theme sits in the same visual family; the wordmark is our own.
- **Real usage only.** Half the prize pool is ranked on on-chain usage, and manipulation disqualifies. Loans cannot be cycled faster than once per 24 hours for promotion, and team wallets are excluded from public stats.
- **Test first, one module per branch and pull request, never push to `main`.**
