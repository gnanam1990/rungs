# Rungs — Product Requirements

## 1. Problem
A person with no credit history cannot borrow even a small amount without collateral, and on-chain this is worse: a wallet is free to replace, so a lender has nothing to hold a borrower to. Agent ID gives 270,000+ people a name that is one per account and cannot be moved or renamed, and today they mostly use it to collect badges. Evidence: `00-context/03-research-evidence.md`.

## 2. Product in one sentence
A holder of an Agent ID borrows a small amount of USDT with no collateral, and each on-time repayment raises their limit and builds a public record on their name.

## 3. Users
| Persona | Who | Wants |
|---|---|---|
| **Starter** (Dewi, Agent ID `dewi.ai`) | Claimed an ID in the campaign, has a few dollars of BNB, uses Binance AI Pro on a phone | Something real to do with the ID; a small buffer; proof she is reliable |
| **Voucher** (Arun, rung 3) | Has repaid three times | To help a friend start higher, and to be seen as someone who backs good people |
| **Integrator** (another hackathon team) | Runs a mint, a marketplace or a job board | A stronger filter than "holds an ID": "holds an ID and has repaid" |
| **Agent** (the holder's AI agent) | Claude, ChatGPT or Binance AI Pro with the wallet skill | Exact, safe instructions: what to call, with what data, and what to show the user |
| **Owner** (KRATOS) | Funds and operates the pool | Bounded loss, honest numbers, no red-line risk |

## 4. Goals and non-goals
Goals
- G1 A holder completes open → draw → repay through their agent in under 5 minutes of their own attention.
- G2 Every limit, fee and promotion is computable from public chain state by anyone.
- G3 The owner's worst-case loss per day and in total is a number set in the contract.
- G4 At least 30 distinct Agent ID addresses interact during the submission period (Innovation Award bar), then as many as the pool can responsibly serve (Pioneer Award).
- G5 Another contract can gate on standing in one line of Solidity.

Non-goals (v0.1)
- No public deposits, no token, no points, no airdrop, no NFT.
- No interest that grows with time; one flat fee per loan.
- No off-chain credit scoring, no KYC of our own, no personal data.
- No automatic repayment. No custody of user funds beyond vouch stakes.
- No other chains.

## 5. The ladder (product rules; exact math in `02-TDD.md` section 4)
| Rung | Limit (USDT) |
|---|---|
| 0 | 1 |
| 1 | 2 |
| 2 | 5 |
| 3 | 10 |
| 4 | 20 |
| 5 | 35 |
| 6 | 50 |

- One open loan per holder. Minimum draw 1 USDT. Term 7 days, then 3 days of grace.
- Fee: 1% of the amount drawn, minimum 0.01 USDT, fixed when drawn. Paid with the repayment. A late repayment adds 1% once.
- **On time and held at least 24 hours and at least half the rung's limit** → counts towards the next rung. One such repayment promotes; a holder with past defaults needs two (one default) or three (two or more).
- **On time but under 24 hours, or under half the limit** → the loan closes cleanly and nothing else changes.
- **Late, inside grace** → the loan closes, the rung stays, the late count goes up, progress towards the next rung resets.
- **Past grace** → anyone may write the loan off. The holder drops to rung 0, the line is frozen and the default count goes up. Paying what is owed later (a **cure**) unfreezes the line at rung 0; the default count never goes down.
- **Vouching**: a holder at rung 2 or higher with no open default stakes USDT behind another holder. The staked amount is added to that holder's limit (up to +50 USDT in total, from at most 3 vouchers; a voucher backs at most 3 people). If the borrower is written off, stakes are taken first. If the borrower later cures, vouchers are paid back first. A stake can be withdrawn whenever the borrower has no open loan.

## 6. User stories and acceptance criteria
**US1 — Open a line.** As a holder I open my line through my agent.
- AC1 Only an address with an Agent ID can open; others get a clear revert reason shown by the agent and the site.
- AC2 The line records the hash of my handle; my handle is shown on my page, escaped.
- AC3 Opening costs gas only.

**US2 — Draw.** As a holder I draw up to my limit.
- AC1 Before I confirm, I see: amount, fee, total to repay, due date and time in my timezone, and what happens if I am late.
- AC2 USDT arrives in my Agentic Wallet in the same transaction.
- AC3 A second draw while one is open is refused.

**US3 — Repay.** As a holder I repay through my agent, or a friend repays for me from any wallet.
- AC1 The approval is for the exact amount due, never more.
- AC2 After repaying I see my new rung, or exactly why I was not promoted.
- AC3 Repayment is never blocked by a pause.

**US4 — See my standing.** As a holder I open my page by link and see my rung, limit, loan, due date, history and the next step, on a phone, without signing in.

**US5 — Vouch.** As a holder in good standing I stake behind a friend and can take the stake back when they have no open loan.
- AC1 I see that the stake is at risk and is taken first on default.

**US6 — Integrate.** As another team I call `standingOf(address)` and gate on it; a copyable `RungsGate` example and a one-page guide exist.

**US7 — Operate.** As the owner I fund the pool, set caps, pause new risk, and see exposure, losses and reserve. Raising a cap takes 2 days; lowering is immediate.

**US8 — Verify.** As a judge I see verified contracts, every owner permission, live counts of distinct Agent ID addresses, loans, repayments, write-offs and the loss rate, each linking to chain evidence.

## 7. Features by module
| Module | Delivers |
|---|---|
| M00 | Repo, CI, protected `main` |
| M01 | Spikes S1–S8, constants file |
| M02 | `packages/core` ladder math, shared vectors |
| M03 | `RungsPool`, `LadderLib`, `IRungsStanding`, tests, invariants |
| M04 | Mainnet deployment with tiny caps, BscScan verification, `OWNER-PERMISSIONS.md`, first real loan |
| M05 | Agent skill, `llms.txt`, `rungs` CLI, copy-paste prompts |
| M06 | Keeper: indexer, read API, calldata API, stats |
| M07 | Web app |
| M08 | Partner kit: `RungsGate`, integration guide, vouch flows end to end |
| M09 | Security review, fixes, cap raise |
| M10 | Traction, demo video, submission, release tag |

## 8. Money model
The flat fee funds a first-loss reserve; above the reserve target it returns to the pool. There is no revenue claim in the hackathon entry. Later options, not built now: integrators paying for standing reads at scale; larger lines funded by licensed partners.

## 9. Success metrics (all read from the chain by the keeper)
- Distinct Agent ID addresses that interacted (target ≥ 30 by 2026-12-03, ≥ 150 by 2026-12-08).
- Loans drawn, repaid on time, repaid late, written off; loss rate by rung.
- Share of holders who took a second loan.
- Vouches placed.
- Number of other contracts or sites reading `standingOf`.

## 10. Risks
See `08-reference/risk-register.md`. The top three: Developer Mode friction or blocking (S1, S2), farmed IDs draining the first rung (caps), and wording that looks like a promise of returns or a lookup tool (tests on copy).

## 11. Scope cut order
See `08-reference/cut-list.md`.
