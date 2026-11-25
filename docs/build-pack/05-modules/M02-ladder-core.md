# M02 — Ladder core

## Goal
The whole ladder as pure TypeScript in `packages/core`, proven against the shared vectors.

## Files
```
packages/core/src/constants.ts
packages/core/src/types.ts      Line, Loan, Phase, Outcome (as const unions; no enums that drift from Solidity numbering)
packages/core/src/ladder.ts     limit, fee, lateFee, phase, due, need, onRepay, onWriteOff, slashSplit, cureSplit, feeSplit
packages/core/src/index.ts
packages/core/test/*.test.ts
```

## Rules
- Follow `02-TDD.md` section 4 line by line. `bigint` for all amounts and times. No `Date`, no `number` in a money path, no I/O.
- `slashSplit(principal, stakes[]) → { perVoucher[], slashed }`: pro rata by stake, rounding down, the remainder added to the largest stake (first on ties).
- `cureSplit(...)` restores in the reverse order: vouchers by what each lost, then reserve, then idle.
- `feeSplit(feeTotal, reserve, reserveTarget) → { toReserve, toIdle }`.
- Outcome numbers: 0 EARLY, 1 SMALL, 2 ON_TIME, 3 PROMOTED, 4 LATE, 5 CURED. Phase numbers: 0 none, 1 current, 2 late, 3 defaultable, 4 writtenOff.
- Load `docs/build-pack/08-reference/schemas/ladder-vectors.json` in tests. If a vector looks wrong, do not edit it: write the disagreement in `DECISIONS.md` and ask.

## Tests first
T-C01 … T-C11.

## Definition of Done
- [ ] All T-C tests pass; coverage of `ladder.ts` is 100% of lines and branches
- [ ] Every vector passes
- [ ] No `number` type in exported signatures for amounts or times

## Ship it
Branch `m02-ladder-core` → local checks → pull request with test counts → checks green → self-review → squash merge.
