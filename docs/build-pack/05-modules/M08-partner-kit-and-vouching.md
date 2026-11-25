# M08 — Partner kit and vouching end to end

## Goal
Make standing useful outside Rungs, and prove vouching with real holders.

## Part A — partner kit
```
contracts/src/RungsGate.sol            abstract contract with modifier onlyGoodStanding(uint8 minLevel)
contracts/test/Gate.t.sol
docs/INTEGRATE.md                      one page: the interface, the address, three copyable snippets (Solidity, viem, curl to the keeper)
contracts/examples/GatedMint.sol       a 40-line example that mints only to holders at rung 1+
```
`onlyGoodStanding(minLevel)` passes when `hasLine && !frozen && level >= minLevel`. The guide says plainly what standing does **not** prove (it is not a credit bureau; a rung is a small repayment history).
[HUMAN] Offer the snippet to three other hackathon teams whose apps gate on Agent ID (launchpads and mints are the obvious fit). Record replies. Do not spam; one message each.

## Part B — vouching
- `packages/skill` gains the vouch, unvouch and claim flows in `SKILL.md` and the CLI if not already complete.
- `/vouch` wallet path finished and tested on a fork.
- [HUMAN] One real vouch on mainnet between two holders (the owner and a friend), followed by a draw that uses it and a repayment; hashes in `PROVEN.md`.

## Tests first
T-G01, T-G02, T-G03.

## Definition of Done
- [ ] Tests pass; the guide's samples compile in CI
- [ ] `INTEGRATE.md` linked from the site's footer and `/agents`
- [ ] The mainnet vouch cycle is recorded, or the reason it could not be done is written down

## Ship it
Branch `m08-partner-kit` → local checks → pull request → checks green → self-review → squash merge.
