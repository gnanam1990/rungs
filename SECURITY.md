# Security

**Rungs is unaudited hackathon software.** This file is the team's own review, not an audit.

## How to report a problem
Open a private security advisory on this repository (Security → Advisories → Report a vulnerability). Please do not open a public issue for anything that could put money at risk.

## Scope
- `contracts/src/RungsPool.sol`, `LadderLib.sol`, `RungsGate.sol`, `IRungsStanding.sol`, `IHandleRegistry.sol` at the commit that adds this file.
- The keeper (`apps/keeper`) and the web app (`apps/web`) for the red lines they must keep (no sign-in, no name lookup, exact approvals, escaped handles).
- Out of scope: the Agent ID registry, USDT, the Binance Agentic Wallet, the spike contracts in `contracts/spikes/` (not part of the product).

## Method
1. **Line-by-line self-review** of `RungsPool` for reentrancy, rounding direction, access control, time boundaries, griefing (can anyone block another user's repay, unvouch or claim?), denial of service through lists, and event completeness. Notes below.
2. **Red-team tests** T-R01 … T-R10 (`contracts/test/RedTeam.t.sol`), plus a test for each finding.
3. **Invariants** I1 … I9 with a handler that makes only valid calls and fails on any revert: 256 runs × 100 depth in CI, and once at **1,000 runs × 200 depth (200,000 calls per invariant, 0 reverts)**.
4. **Fuzz** at 10,000 runs: `LadderLib` against an independent reference.
5. **Shared vectors**: `LadderLib` (Solidity) and `packages/core` (TypeScript) agree on all 92 vectors.
6. **Mainnet fork**: a real Agent ID holder opens, draws real USDT and repays against the real registry.
7. **Static analysis**: `slither 0.11.6`.

## Findings

| ID | Severity | Finding | Status | Fix |
|---|---|---|---|---|
| F-01 | Low | `vouch` accepted a borrower whose line was already frozen by a write-off. The stake could not raise a usable limit (a frozen line cannot borrow) and would sit locked until the borrower cured. | **Fixed** | `vouch` reverts `Frozen` for a frozen borrower; the planner refuses it with a plain reason. Test `test_F01_cannotVouchForFrozenLine`. M09 pull request. |
| F-02 | Low | After a write-off, the unslashed rest of a stake stays locked until the borrower cures (a written-off loan counts as open, as the TDD specifies). A voucher can wait indefinitely. | **Accepted, disclosed** | By design: it keeps vouchers accountable and lets a cure make everyone whole. Now stated in `SKILL.md`, on `/vouch`, and in the contract NatSpec. Test `test_F02_unslashedRemainderWaitsForCure`. |
| F-03 | Low | Anyone at rung 2+ can occupy a holder's three voucher slots with small stakes, so a friend cannot vouch for them. | **Accepted** | Costs the griefer real money at first-loss risk, and only raises the target's limit. The griefer can leave at any time the target has no loan. |
| F-04 | Info | Fees round down (`principal × 100 / 10,000`), by less than one wei per loan, in the borrower's favour. | Accepted | Fees are extra income on top of principal; solvency (I1) never depends on them. Pro-rata slashing is exact (the remainder goes to the largest stake). |
| F-05 | Info | `slither`: 14 results, all `incorrect-equality` on existence checks (`== 0` on our own storage or a soulbound ID count) or `timestamp` on windows that are a day or longer. | Accepted | See the notes below. |
| F-06 | Medium (fixed during M07) | The site's CSS hid page overflow (`overflow-x: hidden`), which masked layout bugs on phones. Found when the 620 px proof spec passed. | **Fixed** | Rule removed; real overflow (unshortened transaction hashes, implicit grid columns) fixed; phone width is asserted on every route. |
| F-07 | Medium (fixed during M06) | `readPool` used viem's cached block number; after a chain rewind it asked for a block that no longer existed, and the API answered "chain could not be read". | **Fixed** | Reads the `latest` block directly. Covered by the keeper's snapshot/revert test. |

**No high or medium finding is open.**

## Self-review notes
- **Reentrancy:** every state-changing function is `nonReentrant`; state is written before the token transfer; a re-entrant token is tested on both the send and the pull side (T-P12).
- **Pull safety:** `repay` computes `dueOf` once and pulls exactly that; it never reads the allowance to decide an amount (T-P07, T-R08, I7). Every pull measures the pool's balance before and after and reverts `BadTransfer` on a mismatch (T-P08).
- **Access control:** owner functions are `onlyOwner`, two-step ownership, `renounceOwnership` disabled. The owner can take only `idle` (T-R06, I6); raises wait 2 days. Full list: `OWNER-PERMISSIONS.md`.
- **Time boundaries:** on time is `now <= dueAt`; late is up to `dueAt + 3 days`; write-off from `dueAt + 3 days + 1 s`; the 24-hour hold counts from the draw. Every boundary has a vector and a test.
- **Griefing:** no one can block another holder's `repay` (anyone may pay for them, and a payer only affects their own allowance), `unvouch` (only the borrower's open loan locks it), or `claim` (no conditions besides a balance). A tiny approval cannot stop a write-off (T-R04).
- **Lists:** `vouchersOf` ≤ 3 per borrower, ≤ 3 borrowers per voucher, and the per-write-off `_slashedBy` list ≤ 3. No unbounded loop.
- **Farming:** a fresh ID can take at most the 1 USDT first rung; first-ever draws are capped per UTC day (T-R03) and total exposure by `maxOutstanding`. Looping does not climb (T-R01).
- **Events:** every money and owner movement emits an event, including `Restored`, `ReserveSwept` and `CapsRaiseCancelled` (added for the keeper and the judges).

## Known limits
- Unaudited. Small pool, tiny first rung, caps set by the owner.
- Identity is only as strong as the Agent ID's "one per Binance account" rule. The registry's owner can mint IDs to any address (`adminRegister`); the caps bound that risk.
- USDT is a centrally issued token.
- The keeper is a convenience: if it is down or wrong, the contract and the `rungs` CLI still work.
