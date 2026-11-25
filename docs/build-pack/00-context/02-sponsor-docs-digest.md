# Sponsor docs digest — exact facts

Read on 2026-11-25. ✅ = verified by a live call or the primary source that day. ⚠ = not verified; the spike that settles it is named.

## 1. Network
| Item | Value | Status |
|---|---|---|
| Chain | BNB Smart Chain mainnet, chain id **56** | ✅ |
| Public RPC | `https://bsc-dataseed.binance.org` (refused a 400-block `eth_getLogs` with "limit exceeded"); `https://bsc-rpc.publicnode.com` (served it) | ✅ |
| Gas price seen | 0.05 gwei | ✅ BscScan |
| Explorer | https://bscscan.com | ✅ |
| Testnet | chain id 97, `https://data-seed-prebsc-1-s1.binance.org:8545` | ⚠ S8 |
| Agent ID on testnet | none found; use a mock registry and a mainnet fork | ⚠ S4 |

## 2. Tokens on BNB Chain
| Token | Address | Decimals | Status |
|---|---|---|---|
| USDT (BSC-USD) | `0x55d398326f99059fF775485246999027B3197955` | **18** | ✅ `decimals()` and `symbol()` called |
| USDC | `0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d` | **18** | ✅ |
| Native BNB (wallet CLI placeholder) | `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` | 18 | ✅ skill docs |

USDT on BNB Chain is a plain BEP-20 with `approve` and `transferFrom` that return `bool`. ⚠ S2 checks whether it has `permit` (assume it does not).

## 3. Agent ID contract
Address `0x60b9262456de011f7d15a54cdd8c48baaa8b022f`. Contract name in source: **`HandleRegistry`**, Solidity 0.8.24, exact match on Sourcify (`https://sourcify.dev/server/v2/contract/56/0x60b9262456de011f7d15a54cdd8c48baaa8b022f?fields=abi`). Token name "SPACE ID Agent ID", symbol "AI". Not a proxy (EIP-1967 implementation slot is zero). 270,061 holders on BscScan on 2026-11-25.

Functions we use (all ✅, called against mainnet):
| Function | Selector | Result |
|---|---|---|
| `balanceOf(address) → uint256` | `0x70a08231` | 1 for a holder, 0 otherwise |
| `handleOf(address) → string` | `0xc50a1514` | the handle without the suffix, e.g. `cxxxz`; **empty string** for a non-holder (does not revert) |
| `ownerOfHandle(string) → address` | `0x1da94fb4` | the holder's address |
| `minLen() → uint8`, `maxLen() → uint8` | `0x60351f9c`, `0x583e1055` | 3 and **20** on-chain (the docs say 3–15) |

Other facts:
- Token id = `uint256(keccak256(bytes(handle)))`. Verified: handle `cxxxz` → `0x154f9f7f…23e855c` equals the id in its mint `Transfer` log.
- Event `Registered(bytes32 indexed labelhash, address indexed owner, string handle)`, topic0 `0x663d34a86c6277aafbd5c6912c96cc5df091e6702ea3ea91b8f378adcbd8a5e5`. Also `AdminRegistered` with the same shape.
- Errors include `Soulbound()`, `AddressHasHandle()`, `HandleTaken()`. `approve` and `setApprovalForAll` are `pure` (they cannot work). One handle per address.
- `totalSupply()` does not exist (reverts). Count holders from `Registered` logs or BscScan.
- `owner()` and `signer()` both returned `0x457c1fd14750c6c30886a2f2b57f1ef44b095882`. The owner can `adminRegister(handle, to)`, so **the registry owner can mint IDs to any address**. This is a trust assumption to state in the README.
- A sampled holder address had no code: Agentic Wallets are plain addresses (MPC), so `msg.sender` is the holder. ⚠ S4 confirms on more samples.
- Docs: one ID per Binance account, 3–15 lowercase letters or digits, cannot be renamed, non-transferable, free to claim apart from gas, claimed only in the Binance App (Wallet → Agent ID). Claiming creates or binds the Agentic Wallet and leaves leftover BNB there for gas.

Minimal interface to copy:
```solidity
interface IHandleRegistry {
    function balanceOf(address owner) external view returns (uint256);
    function handleOf(address owner) external view returns (string memory);
    function ownerOfHandle(string calldata handle) external view returns (address);
}
```

## 4. Agentic Wallet (how holders reach our contract)
Docs: https://web3.binance.com/en/dev-docs/products/agentic-wallet/introduction · security · use-cases/developer-mode. Skill `binance-agentic-wallet` v1.15.0 (needs `baw` CLI ≥ 1.12.0): https://github.com/binance/binance-skills-hub/tree/main/skills/binance-web3/binance-agentic-wallet. Install: `npx skills add binance/binance-skills-hub/skills/binance-web3/binance-agentic-wallet`. Also built into Binance AI Pro (`ai.binance.com`, Binance App 3.22.2+).

Built-in, verified capabilities: sign-in, balances, history, settings, send (recipient must be in the App address book), swap, limit orders, prediction markets, x402 payments, DeFi deposit/redeem/LP, approvals list and revoke, speed up and cancel, domain resolve (`.ai`, `.eth`, `.bnb`), `wallet agent-id`.

**Arbitrary contract calls need Developer Mode.** Facts:
- Enabled only in the Binance App (Agentic Wallet management page → Settings → Developer Mode → read the risk warning → approve a signature). Not from the CLI, the web or the agent.
- Refused if the wallet's total balance is above a balance cap (error `351804`). ⚠ S7: the cap value.
- Stays on for 7 days; each successful use extends it; expired = error `351802`.
- Has its own daily USD limit (`devMode.dailyLimit`), separate from the main, prediction, DeFi and x402 pools. Pools reset at 00:00 UTC. Failed transactions do not restore quota.
- Every operation is preview → show → explicit confirmation → execute. High-risk operations are blocked at preview (`351803 AGENT_DEV_MODE_RISK_BLOCKED`) with no `requestId`. Simulation failure is `351805`.
- Message signing is EIP-712 only. `personal_sign` is not supported, so "Sign in with Ethereum" cannot work. **Our site must never need a signed login.**
- Keys cannot be exported.

Commands (always append `--json`):
```bash
baw wallet settings --json                    # check devMode.enabled, devMode.expiresAt, devMode.dailyLimit
baw wallet address --json
baw wallet agent-id --json                    # { claimed, handle, agentId }
baw contract-call preview --binanceChainId 56 --from <agentWallet> --to <contract> --value 0 --inputData 0x... --json
baw contract-call execute --requestId <id> --json
```
- `--value` is in wei. Do not pass gas price. `--gasLimit` only if the user asks.
- Preview returns `requestId`, `parsedTx`, `simulationResult` (`balanceChanges`, `allowanceChanges`, `authorityChanges`), `risks`, `requireConfirmation`, `expiresAt`.
- Execute returns `status: BROADCASTED` with `txHash`, or `PENDING_CONFIRMATION` (the user approves in the App).
- A `txHash` means broadcast, not confirmed.

⚠ S1: a real holder runs one contract call against a throw-away verified contract on mainnet, through the CLI. ⚠ S2: the same for a USDT `approve` of an exact amount followed by `transferFrom` by a contract, and records whether the risk engine blocks or warns. ⚠ S3: whether Binance AI Pro accepts a pasted contract-call prompt (competitors say users "paste in Binance AI Pro and confirm").

`wallet settings` response shape (fields we read): `devMode.enabled`, `devMode.expiresAt` (Unix seconds), `devMode.dailyLimit`, `devMode.balanceExceeded`, `developerModeQuotaUsed`.

## 5. Things the sponsor already ships (never rebuild; see the research file)
Spending limits and token scope, address book, name-based sending, swaps, limit orders, prediction markets, x402, DeFi deposits, approval revoke (Agentic Wallet). ERC-8004 identity, ERC-8183 job escrow, x402/B402 seller rails (BNB Agent Studio, https://docs.bnbchain.org/developer-kit/bnbchain-studio/).

## 6. Verification on BscScan
⚠ S5: `forge verify-contract --chain 56 --verifier etherscan --etherscan-api-key $BSCSCAN_API_KEY <address> <Contract>` with an Etherscan V2 multichain key. The rules require **BscScan** verification specifically; also push to Sourcify as a second proof. Prove the command on a throw-away contract before M04.

## 7. Brand facts captured from https://web3.binance.com/agent-id
See `04-UIUX-SPEC.md` section 1. Raw values: page `#000000`; text `#FFFFFF`; primary button `#FCD535` with `#000000` text, weight 500, 48px high, radius 8px, padding 0 20px (small buttons 32–36px, radius 4–6px); accent text `#F0B90B`; secondary button `#3D3D3D`/`#333333`; cards `#1A1A1A`; greys `#9C9C9C`, `#7D7D7D`, `#555555`; green `#28A473`; link blue `#5F82D3`; hero heading 64px/700/73.6px, section heading 40px/600/48px, body 16px/24px. Font family `BinanceNova, Arial, sans-serif` (proprietary: do not ship it).
