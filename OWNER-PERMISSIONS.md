# Owner permissions — RungsPool

Written from the NatSpec in `contracts/src/RungsPool.sol`. The contract has no proxy and cannot be upgraded. The ladder constants (limits, fees, term, grace, minimum hold, vouching limits, cap-raise delay) are compile-time constants in `LadderLib.sol`: **nobody, the owner included, can change them.**

## Every owner-only function

| Function | What it can do | What it cannot do | Delay |
|---|---|---|---|
| `fund(amount)` | Adds the owner's own USDT to `idle` (lending capital). | Take anyone else's money. | None |
| `defund(amount)` | Takes back up to `idle` (capital not lent out). | Touch stakes (`totalStaked`), claimables (`totalClaimable`), the reserve, or money already lent. Reverts `PoolShort` above `idle`. | None |
| `sweepReserve(amount)` | Moves reserve into `idle`. | Run while any loan is outstanding (`LoanOpen`). Move more than the reserve. Send tokens anywhere. | None |
| `setCaps(maxOutstanding, dailyNewLineCap)` | Sets the total-outstanding cap and the daily cap on first-ever draws. Lowering applies at once (and cancels a queued raise). | Raise either cap at once: a raise is queued for **2 days** (`CAP_RAISE_DELAY`) and shows on-chain as `CapsRaiseQueued`. Raise one while lowering the other (`MixedCapChange`). Change any open loan. | Raise: 2 days |
| `executeCapsRaise()` | Applies a queued raise after its delay. | Apply it early (`CapRaiseTimelocked`). | — |
| `cancelCapsRaise()` | Drops a queued raise. | — | None |
| `setPaused(bool)` | Stops **new risk only**: `openLine`, `draw`, `vouch`. | Block `repay`, `repayFor`, `writeOff`, `unvouch` or `claim` (they always work, invariant I9). | None |
| `transferOwnership(to)` / `acceptOwnership()` | Two-step owner handover (`Ownable2Step`). | Hand over in one step. | Needs the new owner to accept |
| `renounceOwnership()` | Nothing: always reverts `RenounceDisabled`, so there is always an owner who can pause new risk. | — | — |

## What the owner can never do
- Mint, burn or take any token from a holder's wallet. The pool pulls tokens only from the caller of `repay`, `repayFor`, `vouch` or `fund`, and only the exact amount (`dueOf` for a repayment).
- Touch a voucher's stake or a claimable balance (invariant I6, tested on every owner action in the invariant run).
- Change the fee, the limits or the due date of a loan.
- Freeze, blacklist or seize anything. A line is frozen only by a write-off, which anyone can trigger after due date + 3 days of grace, and only for that loan.
- Upgrade the contract.

## Worst case if the owner key is stolen
The attacker can `defund` what is in `idle` (the owner's own capital) and pause new loans. They cannot take stakes, claimables, the reserve while loans are out, or anything from holders, and a cap raise would show on-chain two days before it takes effect.

## Trust outside this contract
- **Agent ID registry** (`0x60b9…022f`): its owner can mint an ID to any address (`adminRegister`). Rungs trusts the registry's "one ID per Binance account" rule; the caps bound the damage if that rule is broken.
- **USDT** (`0x55d3…7955`): a centrally issued token. The pool checks every incoming transfer and reverts if it receives less than expected.
