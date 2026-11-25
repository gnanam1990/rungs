# Rungs

A credit ladder on the Agent ID. A holder of an Agent ID borrows a small amount of USDT with no collateral, and each on-time repayment raises their limit and builds a public record on their name.

> Status: under construction for the Agent ID Hackathon (submission closes 2026-12-09 08:00 UTC). Nothing is live on mainnet yet. Every change lands through a pull request with green checks.

## What is live

## What is not live

## Owner permissions

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

## Licence
MIT
