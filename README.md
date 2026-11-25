# Rungs

A credit ladder on the Agent ID. A holder of an Agent ID borrows a small amount of USDT with no collateral, and each on-time repayment raises their limit and builds a public record on their name.

> Status: under construction for the Agent ID Hackathon (submission closes 2026-12-09 08:00 UTC). Nothing is live on mainnet yet. Every change lands through a pull request with green checks.

## What is live
Nothing on mainnet yet. Everything below runs and is tested locally and in CI:
- `RungsPool` contract with ladder, vouching, write-off and cure; 88 Foundry tests, 9 invariants (0 reverts over 200,000 calls each), and fork tests against the real Agent ID registry and USDT on BNB Chain.
- `rungs` CLI and the agent skill (`packages/skill/SKILL.md`, `llms.txt`).
- Keeper (indexer + read API) and the web app, tested against a local chain and a mocked API on desktop and phone widths.

Evidence for every claim is in [`PROVEN.md`](PROVEN.md).

## What is not live
- Mainnet deployment, BscScan verification and pool funding (M04, owner's steps).
- The first real loan cycle from an Agent ID through the Agentic Wallet, and spikes S1, S2, S3, S5, S6, S7 (owner's phone).
- Hosting for the keeper and the site; the Agent ID directory listing; the hackathon submission.
- The injected-wallet path on `/vouch` (cut; vouching works through the agent and the contract).
- No audit.

## Owner permissions
See [`OWNER-PERMISSIONS.md`](OWNER-PERMISSIONS.md): fund, defund idle only, sweep the reserve only with nothing lent, set caps (raises wait 2 days), pause new risk only. The owner cannot touch stakes, claimables, open loans or holders' wallets, and cannot change the ladder.

## Trust assumptions
- **Agent ID registry** (`0x60b9…022f`): Rungs trusts its "one ID per Binance account" rule. Its owner can mint an ID to any address; the caps bound that risk.
- **USDT** (`0x55d3…7955`, 18 decimals): a centrally issued token. The pool checks every incoming transfer.
- **The owner** funds the pool and sets caps within the limits above.
- **The keeper** is a read cache and calldata helper; the contract and CLI work without it.

## Known limits
Small pool; tiny first rung (1 USDT); unaudited; identity is only as strong as Binance's one-per-account rule; a holder needs a little USDT for the fee and BNB for gas; a stake behind someone who is written off stays locked until they pay. Full list: [`SECURITY.md`](SECURITY.md).

## Risk notice
Rungs is an experimental, unaudited lending pilot. You can lose money you stake. Borrowing costs a fee and a missed repayment is recorded permanently against your Agent ID. Nothing here is financial advice or a promise of any return.

## Where each number on the stats page comes from
`GET /v1/stats` (keeper). Counts are SQL counts over the contract's events, from the deploy block; each appears twice, with and without the wallets in `TEAM_WALLETS`.
- **holders:** distinct addresses that opened a line, vouched, or paid or claimed while holding a line.
- **loansDrawn / repaidOnTime / repaidLate / cured / promotions:** `Drawn` events; `Repaid` events by outcome (on time = early, small, on time, promoted; late; cured; promoted).
- **writtenOff / byRung loss:** `WrittenOff` events; principal of written-off loans by the rung at which they were drawn.
- **vouches / transactions / volumeDrawn:** `Vouched` events; distinct transactions with a holder event; sum of `Drawn` principal.
- **pool figures** (idle, reserve, outstanding, staked, unrecovered loss, caps): read live from the contract at `asOfBlock`.

## Repo layout
- `contracts/` — Solidity (Foundry)
- `packages/core` — ladder math in TypeScript
- `packages/chain` — addresses, ABIs, calldata
- `packages/skill` — agent skill, `llms.txt`, `rungs` CLI
- `apps/keeper` — indexer and read API
- `apps/web` — web app
- `docs/build-pack/` — the build pack (source of truth)

## Keeper runbook
The keeper (`apps/keeper`) is a read cache and calldata helper. If it is wrong or down, the contract and the `rungs` CLI still work.

- **Start:** copy `.env.example` to `.env`, set `RUNGS_POOL_ADDRESS` and `RUNGS_POOL_DEPLOY_BLOCK`, then `pnpm --filter @rungs/keeper start`. It serves on `KEEPER_PORT` and indexes every `KEEPER_CYCLE_SECONDS`.
- **Restart:** safe at any time. It resumes from the cursor and re-reads the last `REORG_RESCAN_BLOCKS` blocks.
- **Replay:** `pnpm --filter @rungs/keeper replay` drops the events and indexes again from the deploy block. `pnpm --filter @rungs/keeper derived-hash` prints a hash of the derived tables; two replays must print the same hash.
- **Change RPC:** set `BSC_RPC_URL` and restart. If the new RPC refuses big log ranges, lower `LOG_CHUNK`; the indexer also halves the chunk on errors by itself.
- **Team wallets:** list them in `TEAM_WALLETS`; `/v1/stats` reports every number with and without them.
- **Data:** SQLite at `KEEPER_DB_PATH` (one small file). It stores chain events only: no IP addresses, no personal data.

## Licence
MIT
