# M03 — Pool contracts

## Goal
`RungsPool` and `LadderLib` exactly as `02-TDD.md` section 5, with unit, fuzz, invariant and fork tests.

## Files
```
contracts/src/IHandleRegistry.sol
contracts/src/IRungsStanding.sol
contracts/src/LadderLib.sol          pure functions mirroring packages/core
contracts/src/RungsPool.sol          Ownable2Step, ReentrancyGuard, SafeERC20
contracts/test/mocks/MockUSDT.sol    18 decimals; a variant that takes a fee on transfer; a variant that re-enters
contracts/test/mocks/MockHandleRegistry.sol
contracts/test/*.t.sol               as listed in the TDD repo tree
contracts/script/Deploy.s.sol        constructor args from env; prints addresses; sets initial caps
```

## Rules
- Write `LadderVectors.t.sol` (T-L01) **before** `LadderLib`.
- Custom errors, no revert strings: `NotAgentId`, `LineExists`, `NoLine`, `Frozen`, `LoanOpen`, `NoLoan`, `BelowMin`, `AboveLimit`, `PoolShort`, `CapReached`, `DailyCapReached`, `Paused`, `NotDefaultable`, `BadTransfer`, `SelfVouch`, `VouchLevel`, `TooManyVouchers`, `TooManyVouchees`, `VouchCap`, `StakeLocked`, `NothingToClaim`, `MixedCapChange`, `NoCapRaiseQueued`, `CapRaiseTimelocked`, `RenounceDisabled`.
- Measure the pool's balance before and after every pull; revert `BadTransfer` on a mismatch.
- `repay` computes `due` once, pulls exactly that, then books it. Never read allowance to decide an amount.
- No loops over unbounded arrays. Voucher lists are capped at 3.
- NatSpec on every external function saying who can call it and what it can move. `OWNER-PERMISSIONS.md` is written from these comments.
- If `DECISIONS.md` says fallback F2 is in scope, add `RepayBox` and `settleFromBox` per TDD section 5.6 with tests T-P40–44.
- Contract size under 24 KB; if not, move view helpers to a lens contract, not money logic.

## Tests first
T-L01, T-L02, T-P01 … T-P12, T-V01 … T-V05, T-A01 … T-A05, T-I01 … T-I09, T-F01, T-F02.

## Definition of Done
- [ ] All listed tests pass; invariants at 256 runs × 100 depth with zero reverts counted as failures where the handler should succeed
- [ ] `forge coverage` for `RungsPool` and `LadderLib`: lines ≥ 95%, branches ≥ 90%
- [ ] `slither .` run; every finding is fixed or explained in `SECURITY.md`
- [ ] Gas report for `openLine`, `draw`, `repay` in the pull request
- [ ] `OWNER-PERMISSIONS.md` lists every `onlyOwner` function, what it can and cannot do, and its delay

## Ship it
Branch `m03-pool-contracts` → local checks including `forge test` and the fork tests → pull request with coverage, gas and slither output → checks green → self-review against the invariants list → squash merge.
