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
| D12 | 2026-11-25 | M03 | Added `lossOf[borrower]` (`fromReserve`, `socialised`) and `_slashedBy[borrower]` | The cure waterfall must know how a write-off was covered; the TDD storage list did not hold it |
| D13 | 2026-11-25 | M03 | A voucher whose stake is slashed to zero leaves `vouchersOf` and frees a vouchee slot at write-off; their claim on a cure is kept in `slashedOwed` | Otherwise a never-cured default would hold the voucher's slot forever |
| D14 | 2026-11-25 | M03 | Extra events `Restored`, `ReserveSwept`, `CapsRaiseCancelled` | Every money and owner movement is visible to the keeper and to judges |
| D15 | 2026-11-25 | M03 | `socialisedLoss` is the **unrecovered** amount: it goes down when a cure pays it back | The stats page shows cumulative write-offs from events; the contract field shows what is still lost |
| D16 | 2026-11-25 | M03 | Lowering caps cancels a queued raise; `executeCapsRaise` is owner-only | Avoids a stale raise firing after the owner deliberately lowered |
| D17 | 2026-11-25 | M03 | `unvouch` amount above the stake reverts `AboveLimit`, zero reverts `BelowMin` | Reuses the pack's error list instead of adding new errors |
| D18 | 2026-11-25 | M03 | `limitOf` returns 0 for no line or a frozen line | It answers "what can this holder draw now" for integrators |
| D19 | 2026-11-25 | M03 | Deploy script does not set caps; the owner calls `setCaps` and `fund` after deploy | The deployer key holds nothing and is not the owner (CLAUDE.md) |
| D20 | 2026-11-25 | M03 | Slither runs from a Python 3.12 venv in the scratchpad, not installed system-wide | Python 3.15 cannot build a slither dependency (`ckzg`) |
| D21 | 2026-11-25 | M05 | One planner, `planAction(action, snapshot)`, in `packages/chain`; the keeper route and the CLI both call it | The API and CLI must refuse and word things identically; all amounts come from `@rungs/core` |
| D22 | 2026-11-25 | M05 | `approve` takes `purpose=vouch&amount=N` for stakes; without it, it is always the exact live `due` (of `borrower` if given) | A stake also needs an exact approval; the action list in the TDD has one `approve` |
| D23 | 2026-11-25 | M05 | `repay` and `vouch` refuse (`BadInput`) when the allowance is short, naming the exact approval to make | The TDD says refuse when the call would revert; the schema has no dedicated code |
| D24 | 2026-11-25 | M05 | T-H02 runs on a local anvil with the real pool and mock token/registry instead of a mainnet fork | Deterministic, no RPC limits, no key; the mainnet fork is already covered by `Fork.t.sol` |
| D25 | 2026-11-25 | M05 | Server and CLI dates are shown in UTC; the web app shows the visitor's timezone | A server cannot know the reader's timezone |
| D26 | 2026-11-25 | M05 | The banned-word list includes "free"; the skill says "costless" instead | UI spec section 6 bans "free" outright |
| D27 | 2026-11-25 | M05 | CI `ts` job installs Foundry and runs `forge build` first | The ABI-drift test and the anvil test read `contracts/out` |
