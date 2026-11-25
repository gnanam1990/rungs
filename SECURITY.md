# Security

Rungs is **unaudited** hackathon software. Report a problem by opening a private security advisory on this repository.

## Design limits that keep loss small
- No proxy, no upgrade, no oracle, no price, no swap, no delegatecall.
- One loan per holder; first rung is 1 USDT; `maxOutstanding` and `dailyNewLineCap` bound total and daily exposure; raising either takes 2 days.
- Every token pull measures the pool's balance before and after and reverts `BadTransfer` on a mismatch.
- `nonReentrant` on every state-changing function; effects before the token transfer.
- Owner reach is documented in `OWNER-PERMISSIONS.md` and tested (invariant I6).

## Static analysis (M03)
`slither 0.11.6` on `contracts/src` (tests, scripts, spikes and libraries excluded), informational findings excluded. 14 results, all reviewed:

| Detector | Where | Why it is not a bug |
|---|---|---|
| `incorrect-equality` (5) | `registry.balanceOf(x) == 0`, `loan.principal == 0`, `openedAt == 0` | Existence checks on our own storage or on a soulbound ID count. Nothing compares an ETH or token balance that a third party can push. |
| `timestamp` (9) | `draw`, `writeOff`, `_repay`, `executeCapsRaise`, … | Every window is at least a day (term 7 days, grace 3 days, minimum hold 1 day, cap delay 2 days). A validator can move a block time by seconds, which cannot change an outcome in a meaningful way. Several flagged lines do not use the timestamp at all (slither taints the whole function). |

The first run also flagged three `uninitialized-local` variables in `LadderLib.slashSplit`; they were zero by language rule and are now initialised explicitly.

The full self-review lands in M09.
