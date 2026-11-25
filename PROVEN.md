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
