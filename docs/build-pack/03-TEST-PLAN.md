# Rungs — Test Plan

Every test starts **NOT RUN**. Write a module's tests first, watch them fail, then implement. Record real results in `PROVEN.md`.

IDs: `T-C` core, `T-L` LadderLib, `T-P` pool, `T-V` vouch, `T-A` admin, `T-I` invariants, `T-F` fork, `T-H` chain package, `T-K` skill and CLI, `T-S` keeper, `T-W` web, `T-G` gate, `T-R` red team, `T-E` end to end.

## M02 — core
| ID | Test |
|---|---|
| T-C01 | `limit` for every level with 0, 10, 50 and 80 vouched (capped at +50) |
| T-C02 | `fee`: 1 → 0.01, 0.5 is below `MIN_DRAW` (rejected by the caller, fee still 0.01), 2 → 0.02, 50 → 0.5, 100 → 1.0; rounding down on an odd wei amount |
| T-C03 | `phase` at `dueAt`, `dueAt + 1`, `dueAt + GRACE`, `dueAt + GRACE + 1`, and for a written-off loan |
| T-C04 | `due` adds the late fee exactly when `now > dueAt` |
| T-C05 | `onRepay` outcome table: EARLY (23h59m59s), boundary at exactly 24h → qualifies, SMALL (principal × 2 < limit), ON_TIME, PROMOTED, LATE, CURED |
| T-C06 | Probation: with 1 default two qualifying repayments promote; with 2 or 5 defaults three do; a LATE in between resets the streak |
| T-C07 | Top rung: level stays 6 |
| T-C08 | `onWriteOff` resets level and streak, sets frozen, increments defaults; counters saturate |
| T-C09 | All of `ladder-vectors.json` pass |
| T-C10 | Property (fast-check): level never rises by more than 1; `defaults` and `late` never fall; `due >= principal + MIN_FEE` |
| T-C11 | Type-level: no `number` in any money path |

## M03 — contracts
| ID | Test |
|---|---|
| T-L01 | `LadderVectors.t.sol` reads `ladder-vectors.json` with `vm.parseJson` and matches every vector (I10) |
| T-L02 | Fuzz: `LadderLib` vs a slow reference written differently, 10,000 runs |
| T-P01 | `openLine` reverts for a non-holder (`NotAgentId`), succeeds for a holder, reverts twice (`LineExists`); stores `keccak256(handle)` |
| T-P02 | `draw` happy path: balances, `outstanding`, `idle`, event fields |
| T-P03 | `draw` reverts: below `MIN_DRAW`, above limit, with an open loan, frozen, paused, `idle` short, `maxOutstanding` hit, daily new-line cap hit, ID no longer held (mock sets balance 0) |
| T-P04 | Daily cap counts only first-ever draws and resets at the next UTC day |
| T-P05 | `repay` each outcome end to end with time travel; exact pulls; fee to reserve until the target then to idle |
| T-P06 | `repayFor` by a non-holder third party works and the record goes to the borrower |
| T-P07 | Pull safety: allowance exactly `due` works; allowance `due − 1` reverts; the pool never takes more than `due` when allowance is larger |
| T-P08 | A fee-on-transfer mock token makes the pull revert (`BadTransfer`) |
| T-P09 | `writeOff` reverts before `dueAt + GRACE + 1`, works after, by anyone |
| T-P10 | Loss order with no vouchers: reserve first, then socialised; events match |
| T-P11 | Cure: pays principal + fee + late fee; unfreezes at level 0; reserve and idle restored in order |
| T-P12 | Reentrancy: a malicious token callback cannot re-enter any function |
| T-V01 | `vouch` rules: level, self, counts, `MAX_VOUCHED`, `MIN_STAKE`, paused, voucher frozen |
| T-V02 | A vouched borrower can draw `LIMITS[level] + stake` |
| T-V03 | `unvouch` blocked while a loan is open (including written off), allowed otherwise; list and counts updated |
| T-V04 | Write-off with 1, 2 and 3 vouchers: pro-rata slashing sums exactly to `slashed`; remainder to the largest stake |
| T-V05 | Cure after slashing: vouchers' `claimable` restored first and exactly; `claim` pays |
| T-A01 | `setCaps`: first set immediate; lowering immediate; raise queued and not executable before 2 days; mixed change reverts; cancel works |
| T-A02 | `setPaused` blocks only `openLine`, `draw`, `vouch` (I9) |
| T-A03 | `fund`, `defund` (never above `idle`), `sweepReserve` only at zero outstanding |
| T-A04 | Ownership: two-step transfer; `renounceOwnership` reverts; non-owner calls revert |
| T-A05 | No function exists that changes a `Line` or `Loan` other than the documented paths (ABI snapshot test) |
| T-I01–I09 | Invariants I1–I9 with a handler running open, draw, repay, repayFor, writeOff, vouch, unvouch, claim, fund, defund, setCaps, pause and time warps; 256 runs × 100 depth minimum |
| T-F01 | Fork of BNB Chain mainnet: a real holder address (impersonated) opens, draws real USDT (dealt to the pool), approves and repays; `handleOf` hash matches |
| T-F02 | Fork: a non-holder is refused |
| T-P40–44 | Only if fallback F2 is built: box address is deterministic; settle exact, short, excess; another borrower's box cannot be used |

## M04 — mainnet
| ID | Test |
|---|---|
| T-E01 | [HUMAN] Deployed, verified on BscScan, addresses in `PROVEN.md` |
| T-E02 | [HUMAN] The owner's own Agent ID opens, draws 1 USDT and repays after 24 hours through `baw`; all hashes recorded |
| T-E03 | A non-holder wallet's `openLine` reverts on mainnet (simulate with `eth_call`, do not spend gas) |

## M05 — chain package, skill, CLI
| ID | Test |
|---|---|
| T-H01 | Calldata builders match `cast calldata` output for every action (golden file) |
| T-H02 | `read.ts` decodes `standingOf`, `dueOf`, `limitOf` from a fork |
| T-K01 | `rungs calldata draw --amount 1` prints `to`, `data`, a human summary and the exact `baw contract-call preview` line |
| T-K02 | `rungs calldata approve` uses the live `due`, never a larger number, never max uint |
| T-K03 | The CLI refuses a handle where an address is expected |
| T-K04 | `rungs explain <tx>` decodes each event into one plain sentence |
| T-K05 | `SKILL.md` lint: contains the confirmation rule, the Developer Mode check and the secrets rule; contains none of the banned phrases; every command in it parses |
| T-K06 | `llms.txt` renders with live addresses and under 8 KB |
| T-K07 | The CLI has no code path that reads a private key or signs (static check: no `privateKeyToAccount`, no `sendTransaction`) |
| T-K08 | Red-line test: no sentence in the skill tells the agent to skip, pre-approve or batch confirmations |

## M06 — keeper
| ID | Test |
|---|---|
| T-S01 | Indexer on a local anvil scenario reproduces lines, loans and stakes exactly |
| T-S02 | Replay from zero gives a byte-identical derived database |
| T-S03 | Reorg: replaced blocks inside the re-scan window are corrected |
| T-S04 | RPC errors and rate limits: backoff, no gaps, no duplicates |
| T-S05 | `/v1/lines/:address` money fields equal live contract reads |
| T-S06 | `/actions/draw` refuses with a reason when frozen, when a loan is open, above limit, paused or cap-bound |
| T-S07 | `/actions/approve` amount equals `due` at the latest block |
| T-S08 | A handle or any non-address in the path → 400 |
| T-S09 | `/v1/public/site`: blocked country, unknown country under both policies, paused contract, coming-soon flag |
| T-S10 | `/v1/stats` with and without team wallets; every number equals a SQL count over `events` |
| T-S11 | CORS: only `WEB_ORIGIN`; no `Set-Cookie` on any route |
| T-S12 | Handles containing HTML or control characters are returned as JSON strings and never interpreted |

## M07 — web
| ID | Test |
|---|---|
| T-W01 | Two Playwright projects (desktop 1440×900, phone 390×844) with the API mocked; `expectNoSidewaysScroll` on every route; a throw-away spec with a 620px element proves the check can fail |
| T-W02 | `/line/:address` renders each state: no line, open and no loan, loan current, loan late, defaultable, written off, cured, top rung |
| T-W03 | The draw card shows amount, fee, total, due date and the late rule before any command is shown |
| T-W04 | Copy buttons copy exactly the command the API returned (assert clipboard text) |
| T-W05 | Page mode follows `/v1/public/site`: blocked, paused, coming soon, live |
| T-W06 | A handle with `<script>` renders as text |
| T-W07 | Keyboard-only use; axe has no serious issues; visible focus |
| T-W08 | The risk notice is present on every route that shows a command |
| T-W09 | No sign-in, QR, pairing-code or secret input exists anywhere (DOM scan) |
| T-W10 | Banned phrases absent from all copy: "passive income", "automatic money", "guaranteed", "APY", "yield", "earn", "free money", "risk-free" |
| T-W11 | There is no name search; the address field rejects anything that is not an address |
| T-W12 | "Binance" and "BNB" do not appear in the product name, logo alt text, title or domain (they may appear in factual sentences such as "works with the Binance Agentic Wallet" and "BNB Chain") |

## M08 — partner kit
| ID | Test |
|---|---|
| T-G01 | `RungsGate` modifier: passes at or above `minLevel` with no open default, reverts otherwise |
| T-G02 | The guide's code sample compiles in CI |
| T-G03 | Vouch flow end to end on a fork through the CLI's calldata |

## Red team (M09)
| ID | Attack | Expected |
|---|---|---|
| T-R01 | Borrow and repay 20 times in an hour | No promotion (EARLY) |
| T-R02 | Two colluding holders vouch for each other and default | Each loses stake first; the pool's loss is only the unbacked rung |
| T-R03 | 500 fresh IDs draw on one day | Stopped at `dailyNewLineCap` |
| T-R04 | Borrower front-runs `writeOff` with a 1-wei approval | `repay` reverts; write-off proceeds |
| T-R05 | Voucher tries to unvouch just before the borrower's default | Blocked while the loan is open |
| T-R06 | Owner key stolen: attacker tries to drain | Can take only `idle`; cannot touch stakes, claimables or raise caps within 2 days; documented |
| T-R07 | Handle text contains instructions for an agent | The skill treats handles as data; the web escapes them |
| T-R08 | Payer approves max uint | The pool pulls only `due` |
| T-R09 | Donation of USDT to the pool | I1 still holds; books unchanged |
| T-R10 | Write-off, then cure, then draw in one block | Allowed order only; level 0 limit applies |

## Demo acceptance run (M10)
Fresh phone, a real Agent ID, Developer Mode on: open → draw 1 USDT → wait 24 h → approve exact → repay → rung 1 shown on the site → draw 2 USDT. Every step's hash is on the `/open` page.
