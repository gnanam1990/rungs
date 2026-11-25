# Builder assets — what to reuse

The owner's repos are described in `hackathon-db/MY_STACK.md`. Use the patterns below. Do not add a dependency on the repos themselves.

| Module | Repo (licence) | What to lift |
|---|---|---|
| M02, M03 | `gnanam1990/snapfall` (MIT) — `contracts/src/FloatPool.sol` | The idea that the credit rate is a **pure on-chain function of repayment history**: `rate = clamp(base + growth × accepted − penalty × writeOffs, floor, cap)` with constants `BASE 5000`, `GROWTH 500`, `PENALTY 1500`, `FLOOR 3000`, `CAP 8500` bps. Rungs turns this into a discrete ladder. Also: the three-stage loss order (bond slashed → reserve drawn → loss socialised) with one event per stage; `RESERVE_CUT_BPS`; caps that bound the **size** of the book, not only its shape |
| M03 | `snapfall` — `Caps.t.sol`, `AdminHardening.t.sol` | Admin hardening: a cap **raise** is queued for 2 days and a lowering is immediate; a change that raises one cap and lowers another reverts; pause blocks money going **out** to new risk and never blocks repay or withdraw; two-step admin transfer |
| M03 | `snapfall` — `Invariants.t.sol`, `Waterfall.t.sol` | Shape of the invariant and waterfall tests |
| M03 | `gnanam1990/heirloom-protocol` (no licence: pattern only) | Time-based state machine written as explicit states with one transition function, and the audit-remediation habit of a test per finding |
| M04, M09 | `gnanam1990/noticevault`, `sherpa` | Mainnet deployment discipline: tiny amounts first, a deploy script that prints every address, a security review file with findings and fixes |
| M05 | `gnanam1990/sherpa` (Apache-2.0) | Confirmation cards: show the exact amounts and the counterparty before a signature, and deterministic safety checks before building a transaction |
| M06 | `gnanam1990/kiteindex`, `flowops` | Reorg-safe event indexing with a cursor and a re-scan window; reconciling a ledger against chain evidence; an honest status section |
| M07 | `web-app-shipping` skill (in `08-reference/skills/`) | The whole frontend playbook |
| M10 | `uptimebuyer`, `flowops` READMEs | The "what is proven / what is not" README format |

The owner's signature, to keep in the pitch: **provable, fail-closed money for autonomous agents** — deterministic policy decides, authority is bounded, evidence is public, and the README says what is not proven.
