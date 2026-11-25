# Decisions

What we chose where the build pack did not settle it, and why. Newest last.

| # | Date | Module | Decision | Why |
|---|---|---|---|---|
| D1 | 2026-11-25 | M00 | forge-std v1.9.7 and OpenZeppelin v5.1.0 as git submodules under `contracts/lib` | Pinned, reproducible in CI with `submodules: true` |
| D2 | 2026-11-25 | M00 | Workspace packages export their TypeScript source (`exports: ./src/index.ts`); no build step for libraries | Vitest, tsc (Bundler resolution) and Vite read TS directly; one less thing to break |
| D3 | 2026-11-25 | M00 | Repo-local git identity uses the GitHub no-reply address | No machine-wide identity was configured; keeps the owner's email private |
| D4 | 2026-11-25 | M01 | Build M03 for **Plan A** (exact `approve` then `repay`). F2 (repay box) is built only if spike S2 fails | S2 needs the owner's phone and is not run yet; Plan A is the pack's default and F2 is additive |
| D5 | 2026-11-25 | M01 | Keeper RPC: publicnode, `LOG_CHUNK=5000`, halve on error | Spike S8: publicnode served 50,000-block ranges; `bsc-dataseed` refused all ranges |
| D6 | 2026-11-25 | M01 | `PROVEN.md` shows holder addresses shortened and no handles | Red line 9 spirit: the public repo must not become a name → wallet list |
| D7 | 2026-11-25 | M01 | Phase codes: 0 none, 1 current, 2 late, 3 defaultable, 4 writtenOff | Order taken from `ladder-vectors.json` `constants.PHASES` |
| D8 | 2026-11-25 | M01 | Continued past M01 with S1/S2/S3/S5/S6/S7 still open | Owner chose to build all offline modules first; the open spikes are listed in `PROVEN.md` and must be run before M04 |
| D9 | 2026-11-25 | M02 | Line counters (`level`, `streak`, `repaid`, `late`, `defaults`) are `number`; amounts and times are `bigint` | They mirror uint8/uint16 storage and are not money; T-C11 checks every money and time type is bigint |
| D10 | 2026-11-25 | M02 | `cureSplit(principal, slashedPerVoucher, fromReserve)` returns `{toVouchers, toReserve, toIdle}`; idle gets the rest (the socialised part) | TDD section 4 cure waterfall; the pack gives no vectors for it, so round-trip tests against `slashSplit` cover it |
| D11 | 2026-11-25 | M02 | Coverage uses istanbul, not v8 | v8 reported a phantom uncovered "line 1" (the file's opening comment) from source maps |
