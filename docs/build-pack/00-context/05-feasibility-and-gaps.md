# Feasibility and gaps audit (2026-11-25)

## 1. Verified facts
| # | Fact | Source |
|---|---|---|
| V1 | Agent ID contract is `HandleRegistry` at `0x60b9…022f`, not a proxy, source matched on Sourcify | Sourcify API; `eth_getStorageAt` on the EIP-1967 slot |
| V2 | `balanceOf`, `handleOf`, `ownerOfHandle` work as described; `handleOf` returns an empty string for a non-holder | `eth_call` on mainnet against holder `0x93a4d88ae47bd2220e4539491683ca2450b7f904` (handle `cxxxz`) and a non-holder |
| V3 | Token id is the keccak-256 of the handle | computed and compared with the mint log |
| V4 | The sampled holder is an address with no code, so `msg.sender` is the holder | `eth_getCode` |
| V5 | USDT and USDC on BNB Chain have 18 decimals | `eth_call` |
| V6 | Contract calls from an Agentic Wallet exist, behind Developer Mode, with preview and explicit confirmation | Developer Mode doc page, last modified 2026-11-21; skill v1.15.0 `references/external-sign.md` |
| V7 | `personal_sign` is not supported | same page |
| V8 | Other entries already receive contract calls from Agent ID wallets (AgentTrail reported 161 agents on its first day; several teams post "copy the prompt, paste in Binance AI Pro and confirm") | X, `#BinanceWalletHackathon`, 2026-11-23/24 |
| V9 | Rules, dates, scoring weights, red lines | Binance announcement |
| V10 | Listing requirements for the Agent ID page | https://web3.binance.com/agent-id |
| V11 | The registry owner can `adminRegister` a handle to any address | ABI |

## 2. Not verified → spikes (all in M01, day 1)
| Spike | Question | Who | If the answer is bad |
|---|---|---|---|
| **S1** | Can a real holder call a fresh, verified contract through `baw contract-call`? What does the preview show, and is App confirmation required? | [HUMAN] with the owner's own Agent ID | Fallback ladder, section 3 |
| **S2** | Does a USDT `approve(exact)` then a contract `transferFrom` pass the risk engine? Is an `approve` flagged? | [HUMAN] | F1 or F2 |
| S3 | Does Binance AI Pro run a pasted contract-call prompt? | [HUMAN] | Document the CLI path only |
| S4 | On a mainnet fork: 20 sampled holders — all without code? `handleOf` matches logs? | agent | If some are contracts, nothing changes; note it |
| S5 | BscScan verification command with the current API | agent + [HUMAN] key | Verify through the BscScan web form with flattened source |
| S6 | Exact submission form fields and the listing form | [HUMAN] opens them | Update the checklist |
| S7 | Developer Mode balance cap and default daily limit | [HUMAN] reads `wallet settings` | Put the numbers in the user guide; keep loans under the limit |
| S8 | Log range and rate limits of two public RPCs; testnet RPC alive | agent | Smaller chunks; a paid RPC key |

## 3. Fallback ladder for the riskiest dependency (repayment through Developer Mode)
The riskiest step is S2: repaying needs the pool to pull USDT, which needs an approval, and a risk engine may dislike approvals to a new contract.

- **Plan A** — `approve(pool, exactDue)` then `repay()`. Two confirmed calls.
- **F1** — if `approve` is flagged but allowed with a warning: keep Plan A and explain the warning in the skill and the site ("exact amount, one loan, verified contract").
- **F2** — if approvals to our contract are blocked: **repay box**. Each line has a deterministic address (`repayBoxOf(borrower)`, a CREATE2 minimal contract). The holder adds that address to their App address book once and sends USDT there with the built-in, verified `wallet send`. Anyone then calls `settleFromBox(borrower)`, which pulls the box's balance into the pool and applies it. This needs no Developer Mode for repayment at all. The interface is specified in `02-TDD.md` section 5.6 and is built in M03 only if S2 fails.
- **F3** — if USDT is impractical altogether: denominate the pilot in native BNB (`draw` sends BNB, `repay` is `payable`). One call each, no approvals. The ladder limits become BNB amounts fixed at deploy. This changes the product's stability promise, so it is the last resort.

If S1 itself fails (no contract calls at all for our contract): the entry cannot collect Agent ID interactions and the owner must be told the same day. V8 makes this unlikely.

## 4. Red-line compliance map
| Red line | How Rungs complies | Where enforced |
|---|---|---|
| 1 QR / sessions | The site has no sign-in. It reads the chain for an address the user pastes or opens by link. No cookies that identify a wallet | M07, test T-W09 |
| 2 Confirmation | The skill tells the agent to preview, show and wait for a yes on every call, and says so in its first lines | M05, test T-K08 |
| 3 Transfers | No keeper or contract function can move a user's wallet funds except `repay` pulling an amount the user approved for that loan. Approvals are exact. No scheduling | M03 invariants I6, I7 |
| 4 Permissions | `OWNER-PERMISSIONS.md` generated from the contract and shown on the site; the owner cannot touch stakes or change terms of an open loan | M03, M04, M07 |
| 5 Brand | Name "Rungs"; no Binance or BNB in name or domain; no Binance logo; own wordmark | M07, checklist |
| 6 Credentials | No input field accepts a key, phrase, secret or pairing code; the skill forbids asking | M05, M07 |
| 7 Returns | No public deposits; banned-phrase test over all copy | M07 test T-W10 |
| 8 Risk notice | A fixed notice on every page with an action | M07 |
| 9 Name lookup | No name search; pages are keyed by the visitor's own address; `ownerOfHandle` is never called by the site | M06, M07 test T-W11 |
| 10 Manipulation | 24-hour minimum hold before a repayment promotes; one loan at a time; a daily cap on new lines; team wallets flagged in stats | M02, M03, M06 |

## 5. Product gaps → resolutions
| Gap | Resolution |
|---|---|
| A holder needs USDT for the fee and BNB for gas | The first loan is 1 USDT and the fee 0.01 USDT; the guide says "keep the loan, add 0.01 USDT, repay". Gas at 0.05 gwei is far below a cent. State both before the first draw |
| Farmed IDs take 1 USDT each and vanish | Loss is bounded: `dailyNewLineCap` × 1 USDT per day and `maxOutstanding` overall. Both are owner-set, raises are timelocked. The pool starts at USD 50 |
| Wash cycling to climb or to inflate counts | A repayment before `MIN_HOLD` (24 h) closes the loan but does not promote |
| Who funds the pool | The owner's treasury address only (`fund`). No third-party deposits in v0.1 |
| The site cannot connect an Agentic Wallet | It does not need to. Read-only views by address, plus prompts and exact commands for the user's agent. An injected-wallet connect is offered only as a convenience for people who use a normal wallet to **vouch or repay for someone** |
| Reminders | Nothing is pushed or collected. The skill tells the agent to check `GET /v1/lines/:address` when asked; the site shows the due date |
| Legal | Risk notice, no promise of returns, tiny amounts, owner-chosen region list served by the keeper (`BLOCKED_COUNTRIES`) |

## 6. What this audit could not do
No signed call was made from an Agentic Wallet (that needs the owner's phone). The submission form was not opened. Developer Mode's balance cap is unknown. These are S1, S2, S6 and S7, and they come first.
