# Proven

Only what was actually run. Command, exit code, test count, transaction hash. A claim not here is not proven.

## M00 — repo and CI

Run on 2026-11-25, Windows 11, Node v22.23.1, pnpm 10.34.9, forge 1.5.1-stable.

| Command | Exit | Result |
|---|---|---|
| `pnpm lint` | 0 | biome: 23 files, no issues |
| `pnpm typecheck` | 0 | 5 packages |
| `pnpm test` | 0 | 5 files, 5 tests passed (one sanity test per package) |
| `forge fmt --check && forge build && forge test` | 0 | 1 test passed (`Sanity.t.sol`) |
| CI on the first `main` push | success | run 45615932884 (`ts`, `sol`) |
| `gh api -X PUT .../branches/main/protection` | 0 | requires a pull request plus the `ts` and `sol` checks; admins included; squash merge only |

## M01 — spikes and constants (offline part)

Run on 2026-11-25 against BNB Chain mainnet (head ≈ 135,657,000) with forge 1.5.1.

### S4 — 20 recent Agent ID holders (✅)
Holders taken from the last 3,000 blocks of `Registered` logs (first 20 distinct owners). Addresses are shortened and handles left out on purpose (red line 9: we do not publish a name → wallet list).

| # | holder | code | balanceOf | handle length | keccak(handle) == labelhash |
|---|---|---|---|---|---|
| 1 | `0x809b9b…e0ad` | none | 1 | 6 chars | yes |
| 2 | `0x30e71c…a41a` | none | 1 | 8 chars | yes |
| 3 | `0x623fdf…c745` | none | 1 | 9 chars | yes |
| 4 | `0xfe071c…44b2` | none | 1 | 10 chars | yes |
| 5 | `0x39da93…b59c` | none | 1 | 8 chars | yes |
| 6 | `0x61f46c…0a4e` | none | 1 | 7 chars | yes |
| 7 | `0xcb4e9e…50ea` | none | 1 | 8 chars | yes |
| 8 | `0x6419d1…0e52` | none | 1 | 5 chars | yes |
| 9 | `0xd62f85…654d` | none | 1 | 11 chars | yes |
| 10 | `0x17c2fd…6ddb` | none | 1 | 4 chars | yes |
| 11 | `0x47fac9…8fd3` | none | 1 | 10 chars | yes |
| 12 | `0x46f627…b104` | none | 1 | 8 chars | yes |
| 13 | `0xebb0ae…cd24` | none | 1 | 6 chars | yes |
| 14 | `0x1efbce…825f` | none | 1 | 5 chars | yes |
| 15 | `0xf81c21…4655` | none | 1 | 8 chars | yes |
| 16 | `0xb95a85…ef10` | none | 1 | 10 chars | yes |
| 17 | `0x6fac04…b6a9` | none | 1 | 9 chars | yes |
| 18 | `0xc22529…2f0f` | none | 1 | 11 chars | yes |
| 19 | `0xddad25…dc45` | none | 1 | 9 chars | yes |
| 20 | `0xcabca0…79fb` | none | 1 | 8 chars | yes |

Non-holder `0x…dEaD`: `balanceOf` = 0, `handleOf` = `""` (no revert). Every sampled holder is a plain address, so `msg.sender` is the holder.

### S8 — RPC log ranges (✅)
| RPC | 100 | 400 | 1,000 | 5,000 | 10,000 | 50,000 |
|---|---|---|---|---|---|---|
| `bsc-rpc.publicnode.com` | ok | ok | ok | ok | ok | ok (361 logs) |
| `bsc-dataseed.binance.org` | -32005 | -32005 | -32005 | -32005 | -32005 | -32005 |
| `bsc.drpc.org` | ok | 400 "ranges over 100 blocks" | ✗ | ✗ | ✗ | ✗ |
| testnet `data-seed-prebsc-1-s1` | `cast chain-id` = 97, head 144,790,232 | | | | | |

Decision: keeper uses publicnode, `LOG_CHUNK=5000`, halves the chunk on any error. A keyed RPC is still advised for production.

### Other live checks
| Check | Result |
|---|---|
| `cast sig "ping()"` | `0x5c36b186` (matches the pack) |
| registry `minLen()` / `maxLen()` | 3 / 20 |
| USDT `decimals()` | 18 |
| USDT runtime code contains `permit`/`nonces`/`DOMAIN_SEPARATOR` selectors | no; EIP-1967 slot is zero |

### Tests
| Command | Exit | Result |
|---|---|---|
| `pnpm test` (before implementing) | 1 | `constants.test.ts`, `addresses.test.ts` fail: modules missing |
| `forge build` (before implementing) | 1 | `IHandleRegistry.sol`, `spikes/Ping.sol` not found |
| `pnpm lint && pnpm typecheck && pnpm test` | 0 | 12 tests passed |
| `forge test` | 0 | 4 passed, fork suite skipped (no `BSC_RPC_URL`) |
| `BSC_RPC_URL=https://bsc-rpc.publicnode.com forge test --match-contract RegistryFork` | 0 | 2 passed (holder `cxxxz` facts, non-holder facts) |

### Still open — [HUMAN] spikes
| Spike | Status |
|---|---|
| S1 contract call from an Agentic Wallet to `Ping` | ⚠ not run — needs the owner's phone, Developer Mode, a mainnet deploy of `contracts/spikes/Ping.sol` |
| S2 exact `approve` + `Pull.pull()` | ⚠ not run — decides Plan A / F1 / F2 |
| S3 Binance AI Pro pasted prompt | ⚠ not run |
| S5 BscScan verification command | ⚠ not run — needs the owner's API key |
| S6 submission and listing form fields | ⚠ not run |
| S7 Developer Mode balance cap and daily limit | ⚠ not run |

## M02 — ladder core

| Command | Exit | Result |
|---|---|---|
| `npx vitest run` in `packages/core` before `ladder.ts` existed | 1 | 35 failed: `fee is not a function`, `slashSplit is not a function` … |
| `pnpm --filter @rungs/core test` (`vitest run --coverage`, typecheck on) | 0 | 94 tests passed, 0 type errors; `ladder.ts` 100% statements, branches, functions, lines (istanbul, enforced as a threshold) |
| shared vectors | — | all 28 `limit`, 9 `fee`, 7 `phase`, 5 `due`, 25 `onRepay`, 4 `onWriteOff`, 8 `slashSplit`, 6 `feeSplit` pass |
| fast-check properties | — | 3 properties × 2,000 runs |

## M03 — pool contracts

| Command | Exit | Result |
|---|---|---|
| `forge build` before `LadderLib.sol` existed | 1 | `Source "src/LadderLib.sol" not found` (vector test written first) |
| `forge test` | 0 | 72 passed, 2 skipped (fork suites without RPC), 12 suites |
| `BSC_RPC_URL=https://bsc-rpc.publicnode.com forge test --match-contract "ForkTest\|RegistryFork"` | 0 | 4 passed: real holder `cxxxz` opens, draws 1 real USDT, repays 1.01 after 24 h, reaches rung 1; a non-holder is refused (T-F01, T-F02) |
| invariants I1–I9 | 0 | 9 passed, 256 runs × 100 depth = 25,600 calls each, **0 reverts** with `fail-on-revert = true`. Reachability probed: draw, climb, repay, repayFor, writeOff, vouch, unvouch, slash+cure, claim, executeCaps all occur in runs |
| T-L01 vectors | 0 | 28 limit, 9 fee, 7 phase, 5 due, 25 onRepay, 4 onWriteOff, 8 slashSplit, 6 feeSplit — same vectors as `packages/core` (I10) |
| T-L02 fuzz | 0 | LadderLib vs an independent reference, 10,000 runs each for limits/fees, onRepay, slashSplit |
| `forge coverage --no-match-coverage "(test\|script\|spikes)" --ir-minimum` | 0 | `RungsPool` 99.59% lines, 94.12% branches, 100% functions; `LadderLib` 98.70% lines, 100% branches |
| `forge build --sizes` | 0 | `RungsPool` runtime 14,542 bytes (limit 24,576) |
| `slither .` (0.11.6, src only, no informational) | 0 | 14 results, all `incorrect-equality` on existence checks or `timestamp` on day-long windows; explained in `SECURITY.md` |

Gas (`forge test --match-contract PoolTest --gas-report`, median): `openLine` 80,649 · `draw` 130,255 · `repay` 72,676 · `repayFor` 86,820 · `writeOff` 93,562.

## M05 — chain package, skill and CLI

| Command | Exit | Result |
|---|---|---|
| `npx vitest run` in `packages/chain` before `actions.ts`/`events.ts` | 1 | 4 files fail to import |
| `npx vitest run` in `packages/skill` before the CLI | 1 | 20 failed |
| `pnpm --filter @rungs/chain test` | 0 | 37 passed, 1 skipped placeholder: T-H01 golden calldata from `cast calldata`, generated ABI equals the Foundry artifact, planner refusals and summaries, T-K04 event sentences |
| T-H02 (anvil) | 0 | local anvil + real `RungsPool` from `contracts/out`: open → draw 1 → wait 24 h → approve exactly 1.01 → repay → rung 1, every call built by `planAction`; stranger refused before any transaction. No private key used (anvil unlocked accounts) |
| `pnpm --filter @rungs/skill test` | 0 | 23 passed: T-K01 … T-K08 (SKILL.md lint, llms.txt 8 KB, red-line sentence check, static no-signing scan) |
| `pnpm --filter @rungs/skill build && node dist/rungs.mjs --help` | 0 | CLI bundle builds and runs; without a pool it says "Rungs is not deployed yet" |

Not done: [HUMAN] the owner's agent completing a draw using only `SKILL.md` and the prompt (needs M04 deployed).

## M06 — keeper

| Command | Exit | Result |
|---|---|---|
| `pnpm --filter @rungs/keeper test` | 0 | 21 passed |
| fake-chain tests | 0 | T-S02 replay hash identical; T-S03 a vouch replaced by a reorg inside the re-scan window is corrected; T-S04 public-RPC range limit (700 blocks) and two rate-limit errors: chunk halves 5000 → ≤700, backoff, same derived hash as a clean run, no duplicates; a run that keeps failing writes nothing |
| anvil scenario | 0 | 4 holders (one with handle `<script>alert(1)</script>\u0007`), 6 draws, 3 promotions, a vouch, a write-off with slashing, a cure, a claim. T-S01 derived `lines`/`loans`/`stakes` equal `lineOf`/`loanOf`/`stakeOf`; T-S02 replay and a fresh database give the same hash; T-S05 money fields equal `standingOf`/`limitOf`/`dueOf`; T-S06 draw refused for LoanOpen, AboveLimit, NotAgentId, Paused, CapReached, Frozen; T-S07 approve = live due; T-S08 names → 400; T-S10 stats equal SQL counts, team view drops the team wallet; T-S11 CORS only for `WEB_ORIGIN`, no `Set-Cookie` on 9 routes; T-S12 hostile handle returned as a JSON string with the control character replaced |
| `KEEPER_PORT=8799 tsx scripts/dev-local.ts` + `curl` | 0 | `/v1/lines/<dewi>` → rung 1, loan 2 USDT, `nextStep: repay`; `/actions/approve` → exactly 2.02 USDT; `/v1/stats` → 4 holders, 13 transactions |

Bug found and fixed: viem caches `getBlockNumber`, so after a chain rewind `readPool` asked for a block that no longer existed. `readPool` now fetches `latest` directly.

Not done: [HUMAN] keeper hosting and the mainnet replay hash (needs M04 deployed and a host account).

## M07 — web app

| Command | Exit | Result |
|---|---|---|
| `pnpm --filter @rungs/web e2e` (vite build + Playwright, desktop 1440×900 and phone 390×844, API mocked) | 0 | 124 passed: T-W01 … T-W12 |
| throw-away spec with a 620 px element (deleted after) | 1 | phone project failed as it must: `Expected <= 390, Received 636` |
| `pnpm --filter @rungs/web test` | 0 | 5 passed (copy lint over every string in `strings.ts`, format) |
| `vite build` | 0 | JS 189 KB (59 KB gzip); CSP meta: `default-src 'self'`, `connect-src` the keeper only, no inline scripts |

Bugs the tests found and that were fixed: `overflow-x: hidden` on `html`/`body` masked overflow (the 620 px proof first passed); transaction hashes were not shortened and widened the phone page to 587 px; single-column grids grew to content width; the address field's error text sat inside its `<label>` and changed its accessible name; scrollable tables were not keyboard-focusable (axe `scrollable-region-focusable`).

Screenshots (every route and every `/line` state, both widths): branch `assets/m07-screenshots`, e.g. [phone line, late](https://raw.githubusercontent.com/gnanam1990/rungs/assets/m07-screenshots/m07/phone-line-late.jpg), [desktop home](https://raw.githubusercontent.com/gnanam1990/rungs/assets/m07-screenshots/m07/desktop-home.jpg).

Not done: Lighthouse scores (cut list item 5); [HUMAN] hosting, domain, and the "List Your dApp" application.

## M08 — partner kit and vouching

| Command | Exit | Result |
|---|---|---|
| `forge build` before `RungsGate.sol` existed | 1 | `Source "src/RungsGate.sol" not found` |
| `forge test --match-contract GateTest` | 0 | 4 passed: T-G01 passes at or above `minLevel`, reverts with no line, reverts when frozen even at rung 0 and passes again after a cure; T-G02 `GatedMint` mints only at rung 1+, once |
| `pnpm --filter @rungs/chain test` (integrate-doc) | 0 | T-G02: the guide's Solidity block **is** `contracts/examples/GatedMint.sol` (compiled by forge in CI), the TS block **is** `packages/chain/examples/standing.ts` (typechecked in CI), the interface lines match `IRungsStanding.sol` |
| `pnpm --filter @rungs/skill test` (vouch integration) | 0 | T-G03 on anvil with the real pool, every call from `rungs calldata`: climb to rung 2 (8 calls), approve exactly 3 for a stake, vouch, borrower draws 4 (1 + 3), unvouch refused while the loan is open (`StakeLocked`), repay, rung 1, unvouch 3, `totalStaked` back to 0 |
| `pnpm --filter @rungs/web e2e` | 0 | 126 passed (adds: `INTEGRATE.md` linked from the footer and `/agents`) |

Not done: [HUMAN] the mainnet vouch cycle between two real holders (needs M04 deployed); [HUMAN] one message each to three hackathon teams offering the snippet; the `/vouch` wallet path (cut, D34).

## M09 — security review (offline part)

| Command | Exit | Result |
|---|---|---|
| `forge test --match-contract RedTeamTest` before the fix | 1 | T-R01 … T-R10 pass; `test_F01_cannotVouchForFrozenLine` fails (finding F-01 confirmed) |
| `forge test` after the fix | 0 | 88 passed, 2 skipped (fork suites without RPC) |
| `FOUNDRY_FUZZ_RUNS=10000 FOUNDRY_INVARIANT_RUNS=1000 FOUNDRY_INVARIANT_DEPTH=200 forge test` | 0 | 88 passed in 118 s; each invariant I1–I9: 1,000 runs, 200,000 calls, **0 reverts** |
| `BSC_RPC_URL=https://bsc-rpc.publicnode.com forge test --match-contract "ForkTest\|RegistryFork"` | 0 | 4 passed |
| `slither .` (src only, no informational) | 0 | 14 results, same categories as M03, all explained in `SECURITY.md` |
| `forge build --sizes` | 0 | `RungsPool` 14,609 bytes |
| `pnpm lint && pnpm typecheck && pnpm test` | 0 | core 94, chain 40, skill 24, keeper 21, web 5 |
| banned-phrase check over `README.md`, `SECURITY.md`, `OWNER-PERMISSIONS.md`, `docs/INTEGRATE.md` | 0 | none found |

Not done: [HUMAN] review live numbers and decide caps; queue, fund and execute the cap raise (needs M04).

## M04 prep (offline)

| Command | Exit | Result |
|---|---|---|
| `forge test --match-contract ReadBackTest` | 0 | 2 passed: read-back passes on a correct pool and reverts `maxOutstanding` on a mismatch |
| `scripts/simulate-nonholder.sh` against a local pool (anvil, `dev-local.ts`) | 0 | `T-E03 OK: openLine from a non-holder reverts NotAgentId (0xdfc3592e)` |
| `cast sig "pull()"` | 0 | `0x329eb839` (used in the runbook for spike S2) |

The mainnet steps themselves are in `docs/M04-RUNBOOK.md` and are the owner's.

## M07 follow-up: draw amount fits the pool; coming soon stops the API (web-app-shipping §6, §2)

| Command | Exit | Result |
|---|---|---|
| `vitest run test/actions.test.ts` (chain) and `vitest run test/site.test.ts` (keeper), before the code | 1 | 5 chain tests and the keeper site file fail: `drawableNow` and `refuseWhileComingSoon` do not exist yet |
| same, after | 0 | chain 27 passed; keeper site 8 passed |
| `playwright test -g T-W13` against the old `NextStepCard.tsx` from `main` | 1 | 2 failed (desktop, phone): the amount field shows `10`, expected `4` |
| `pnpm lint && pnpm typecheck && pnpm test` | 0 | core 94, chain 45 (+1 fork skipped), skill 24, web 5, keeper 24 (includes the anvil check `drawNow: "0"` while a loan is open) |
| `forge test` | 0 | 90 passed, 2 skipped (fork); no contract change |
| `pnpm --filter @rungs/web e2e` | 0 | 134 passed, 34 skipped (`screens.spec.ts` runs only with `SCREENSHOTS=1`) |
