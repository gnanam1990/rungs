# M06 — Keeper

## Goal
The indexer and read API in `02-TDD.md` section 6, deterministic from chain events.

## Files
```
apps/keeper/src/db.ts          schema + migrations (better-sqlite3)
apps/keeper/src/indexer.ts     chunked getLogs, cursor, reorg re-scan, derive tables
apps/keeper/src/routes/{site,config,lines,actions,stats,events,docs}.ts
apps/keeper/src/site.ts        page-mode decision (pure function of headers, env, paused)
apps/keeper/src/stats.ts       SQL only
apps/keeper/src/server.ts      Hono; CORS; rate limit; no cookies
apps/keeper/test/*.test.ts     against anvil
```

## Rules
- Money fields in `/v1/lines/:address` come from live `eth_call`s (`standingOf`, `dueOf`, `limitOf`, `loanOf`), not from the database. History comes from the database.
- `/actions/*` validates against live state and returns either a ready call or `{ ok: false, reason }` with the same wording the site uses.
- Reject any path segment that is not `0x` + 40 hex characters with 400. Never call `ownerOfHandle`.
- Short write transactions; the indexer is the only writer.
- `team` addresses come from `TEAM_WALLETS`; stats return both views and say which is which.
- Every response includes `asOfBlock`.
- Rate limit per IP; cache `/v1/stats` and `/v1/config` for a few seconds.
- Log no IP addresses beyond what the host does; store no personal data.

## Tests first
T-S01 … T-S12.

## Definition of Done
- [ ] All listed tests pass
- [ ] Replay from the deploy block on mainnet matches a second replay byte for byte (hash of the derived tables in `PROVEN.md`)
- [ ] Deployed ([HUMAN] creates the host account and sets env); `/v1/config` and `/v1/stats` answer on the public URL
- [ ] A short runbook in the README: restart, replay, change RPC

## Ship it
Branch `m06-keeper` → local checks → pull request with sample responses → checks green → self-review → squash merge.
