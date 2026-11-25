# Integrate with Rungs

Rungs records, on BNB Chain, whether an Agent ID holder has borrowed small amounts and paid them back on time. Any contract or app can read that record with **one view call** and use it as a filter: "holds an Agent ID **and** has repaid".

- **RungsPool (BNB Chain, chain id 56):** not deployed yet — the address will be in `GET <keeper>/v1/config` and in the repository README.
- **Source:** `contracts/src/IRungsStanding.sol`, `contracts/src/RungsGate.sol`.
- **Cost:** a view call; no fee, no registration, no key.

## The interface

```solidity
interface IRungsStanding {
    struct Standing {
        bool hasLine;
        uint8 level;
        uint16 repaid;
        uint16 late;
        uint16 defaults;
        bool frozen;
        bool hasOpenLoan;
    }

    function standingOf(address holder) external view returns (Standing memory);
    function limitOf(address holder) external view returns (uint256);
    function dueOf(address holder) external view returns (uint256 amount, uint64 dueAt, uint8 phase);
}
```

`level` is the rung, 0 to 6 (limits 1, 2, 5, 10, 20, 35, 50 USDT). `frozen` is true after a write-off until the holder pays it back. `defaults` and `late` never go down.

## 1. Solidity: gate a function

Inherit `RungsGate` and add `onlyGoodStanding(minLevel)`. Good standing means: has a line, not frozen, rung at or above `minLevel`. This example is compiled and tested in CI (`contracts/examples/GatedMint.sol`, `contracts/test/Gate.t.sol`):

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IRungsStanding} from "../src/IRungsStanding.sol";
import {RungsGate} from "../src/RungsGate.sol";

/// @notice Example: one pass per wallet, only for Rungs holders at rung 1 or higher
///         (they have repaid at least once, on time) and not frozen by a write-off.
contract GatedMint is ERC721, RungsGate {
    uint256 public nextId = 1;
    mapping(address => bool) public minted;

    error AlreadyMinted();

    constructor(IRungsStanding rungs_) ERC721("Rungs Gated Pass", "RGP") RungsGate(rungs_) {}

    function mint() external onlyGoodStanding(1) {
        if (minted[msg.sender]) revert AlreadyMinted();
        minted[msg.sender] = true;
        _mint(msg.sender, nextId++);
    }
}
```

## 2. TypeScript (viem): check before you show a button

Typechecked in CI (`packages/chain/examples/standing.ts`):

```ts
import { http, createPublicClient, parseAbi } from "viem";
import { bsc } from "viem/chains";

const RUNGS = "0x0000000000000000000000000000000000000000"; // RungsPool address from /v1/config

const abi = parseAbi([
  "struct Standing { bool hasLine; uint8 level; uint16 repaid; uint16 late; uint16 defaults; bool frozen; bool hasOpenLoan; }",
  "function standingOf(address holder) view returns (Standing)",
]);

const client = createPublicClient({ chain: bsc, transport: http("https://bsc-rpc.publicnode.com") });

export async function inGoodStanding(holder: `0x${string}`, minLevel: number): Promise<boolean> {
  const s = await client.readContract({ address: RUNGS, abi, functionName: "standingOf", args: [holder] });
  return s.hasLine && !s.frozen && s.level >= minLevel;
}
```

## 3. curl: the keeper's read API

```bash
curl -s https://<keeper>/v1/lines/0xHolderAddress | jq '.standing'
# { "level": 2, "streak": 0, "repaid": 3, "late": 0, "defaults": 0, "frozen": false, "need": 1 }
```

The keeper is a cache. For anything that matters, read the contract.

## What standing does **not** prove
- It is **not a credit score** and not a credit bureau. Rung 2 means a holder repaid a few loans of a few USDT on time. It says nothing about income, other debts or identity beyond the Agent ID.
- It is only as strong as the Agent ID's "one per Binance account" rule, and the Agent ID registry's owner can mint IDs to any address.
- A holder with no line has **no** record, not a bad one.
- The contract is unaudited.

Use it as one small signal among others, never as the only reason to move someone's money.

## Rules for integrators
- Key everything by wallet address. Do not build a "search a name, see the wallet" feature on top of Rungs.
- Rungs never needs a user's keys, seed phrase, pairing code or QR code, and neither should your integration.
