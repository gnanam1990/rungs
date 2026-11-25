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
