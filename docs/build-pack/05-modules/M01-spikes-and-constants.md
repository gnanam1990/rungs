# M01 — Spikes and constants

## Goal
Settle every ⚠ in `00-context/02-sponsor-docs-digest.md` and `00-context/05-feasibility-and-gaps.md` section 2 on day 1, and write the verified constants into code.

## Spikes
| ID | What to do | Output |
|---|---|---|
| **S1** [HUMAN] | Deploy `Ping.sol` (one function `ping()` that emits `Pinged(msg.sender)`) to BNB Chain mainnet, verify it. The owner enables Developer Mode in the Binance App and, from their own agent, runs `baw wallet settings --json`, `baw wallet address --json`, then `baw contract-call preview --binanceChainId 56 --from <wallet> --to <Ping> --value 0 --inputData 0x5c36b186 --json` and `execute`. | Preview JSON (redacted), `requireConfirmation`, risk lines, tx hash, time taken |
| **S2** [HUMAN] | Deploy `Pull.sol` (pulls an exact approved USDT amount and sends it straight back). The owner approves exactly 0.01 USDT to it and calls `pull()`. | Whether `approve` previews with a warning, a block (`351803`) or cleanly; both hashes. **Decides Plan A / F1 / F2** |
| S3 [HUMAN] | Paste a contract-call prompt into Binance AI Pro. | Works or not, with a screenshot |
| S4 | On an anvil fork: take 20 holders from recent `Registered` logs; check `eth_getCode`, `balanceOf`, `handleOf`, and that `keccak256(handle)` equals the token id. | Table in `PROVEN.md` |
| S5 | Verify `Ping.sol` on BscScan with forge and an API key ([HUMAN] creates the key). Push to Sourcify too. | The exact working command |
| S6 [HUMAN] | Open "Submit Project Now" on the announcement and "List Your dApp" on the Agent ID page; copy every field name and limit. Do not submit. | `07-demo-and-submission/submission-checklist.md` updated |
| S7 [HUMAN] | Read `devMode.dailyLimit`, `devMode.expiresAt`, and try to learn the balance cap (the App shows it when enabling). | Numbers in the digest |
| S8 | Measure the largest `eth_getLogs` block range and rate limit on two public RPCs and one keyed RPC; check the testnet RPC. | `LOG_CHUNK` and RPC choice |

`0x5c36b186` is `ping()`; recompute with `cast sig "ping()"` and use the computed value.

## Then
- Write `packages/chain/src/addresses.ts` (chain id, registry, USDT, deploy blocks to be filled in M04) and `packages/core/src/constants.ts` exactly as `02-TDD.md` section 3.
- Update the digest: turn each ⚠ into ✅ or ❌ with the evidence. If S2 is ❌, record in `DECISIONS.md` that fallback F2 (repay box) is in scope for M03.
- If S1 is ❌, stop and tell the owner today.

## Tests first
A fork test that asserts the registry facts (S4) so they are re-checked in CI when `BSC_RPC_URL` is set; a unit test that the constants equal the pack's values.

## Definition of Done
- [ ] S1–S8 each have a result and evidence in `PROVEN.md`
- [ ] The digest has no unexplained ⚠
- [ ] The Plan A / F1 / F2 / F3 decision is written in `DECISIONS.md`
- [ ] The spike contracts are in `contracts/spikes/`, clearly marked as not part of the product

## Ship it
Branch `m01-spikes` → local checks → pull request with the spike evidence → checks green → self-review → squash merge.
