# M09 — Security review and scaling the pool

## Goal
Find and fix what is wrong before more money and more people arrive, then raise the caps deliberately.

## Steps
1. Run the red-team list T-R01 … T-R10 as Foundry tests and keeper or web tests where they apply.
2. Self-audit `RungsPool` line by line against: reentrancy, rounding direction (always against the caller, never against the pool's solvency), access control, time boundaries, griefing (can anyone block another user's repay, unvouch or claim?), denial of service through lists, event completeness.
3. `slither` and `forge test --fuzz-runs 10000` and invariants at 1000 runs × 200 depth, once.
4. Write `SECURITY.md`: scope, method, findings (ID, severity, status, fix commit), known limits, how to report.
5. If a finding needs a contract change: deploy a new pool, pause the old one (repayments stay open), and submit both addresses. Record why. Never try to migrate lines by hand.
6. Review the live numbers with the owner: holders, loss rate by rung, how many first loans went unpaid. Decide new caps from them.
7. [HUMAN] Queue the cap raise (`setCaps`), fund more capital, and execute after 2 days. Recommended ceiling for the hackathon: `maxOutstanding` 500 USDT, `dailyNewLineCap` 60. The owner decides.
8. Re-check the red-line map in `00-context/05-feasibility-and-gaps.md` against the live site and skill, line by line, and tick each in the pull request.

## Tests first
T-R01 … T-R10.

## Definition of Done
- [ ] All red-team tests pass
- [ ] `SECURITY.md` complete; no open high or medium finding
- [ ] Cap decision and transactions recorded
- [ ] Red-line checklist ticked with a link or screenshot for each line

## Ship it
Branch `m09-security` → local checks → pull request with the findings table → checks green → self-review → squash merge.
