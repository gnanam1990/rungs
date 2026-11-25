# Rungs

A credit ladder on the Agent ID. A holder of an Agent ID borrows a small amount of USDT with no collateral, and each on-time repayment raises their limit and builds a public record on their name.

> Status: under construction for the Agent ID Hackathon (submission closes 2026-12-09 08:00 UTC). Nothing is live on mainnet yet. Every change lands through a pull request with green checks.

## What is live

## What is not live

## Owner permissions
See [`OWNER-PERMISSIONS.md`](OWNER-PERMISSIONS.md): fund, defund idle only, sweep the reserve only with nothing lent, set caps (raises wait 2 days), pause new risk only. The owner cannot touch stakes, claimables, open loans or holders' wallets, and cannot change the ladder.

## Trust assumptions

## Known limits

## Risk notice

## Where each number on the stats page comes from

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
