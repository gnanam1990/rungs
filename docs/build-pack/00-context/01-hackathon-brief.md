# Hackathon brief — Agent ID Hackathon (Binance Wallet × BNB Chain)

Sources, read on 2026-11-25:
- Announcement: https://www.binance.com/en/support/announcement/detail/95f5dbe0ea674a48a739b59e046648bf
- Post: https://x.com/BinanceWallet/status/2122973166758945045
- Agent ID page: https://web3.binance.com/agent-id

## 1. Dates
| What | When (UTC) |
|---|---|
| Submission period | 2026-11-18 08:00 → **2026-12-09 08:00** |
| Internal review | 2026-12-09 08:00 → 2026-12-17 08:00 |
| Public review | 2026-12-17 08:00 → 2026-12-20 08:00 |
| Rewards | within 14 business days after public review |

Only activity **inside the submission period** counts. Our internal finish line is **2026-12-08 18:00 UTC** (see `08-reference/day-plan.md`).

## 2. Prizes (60,000 USDC)
Two awards of 29,000 USDC each: 10,000 / 6,000 / 4,000 / 3,000 / 2,000 / 5 × 800. One team submits one project, and a project can win only one award. All 20 winners also get a slot to claim a two-character Agent ID. A separate 2,000 USDC goes to 20 community posts on X with `#BinanceWalletHackathon` and `#AgenticWallet`.

- **Agent ID Ecosystem Pioneer Award** — ranked from on-chain data in the period: number of Agent ID holder addresses that interacted with the submitted contracts, plus transaction volume or transaction count. Only submitted contract addresses count, and only addresses that hold an Agent ID.
- **Agent Application Innovation Award** — scored by a panel from Binance Wallet and BNB Chain. Entry bar: the product is live and **at least 30 Agent ID addresses** interacted with the contracts in the period.

## 3. Innovation Award scoring → what the judges see → module
| Criterion | Weight | What we show | Module |
|---|---|---|---|
| Agent ID application depth | 30% | The ID is the borrower record and the only requirement to borrow. Handle hash stored at open. Vouching is ID-to-ID. Other apps read standing by address | M03, M08 |
| Practicality and feasibility | 25% | Real loans on mainnet with real repayments; loss bounded by caps; a first-loss reserve; the numbers on a public stats page | M04, M06, M09 |
| Product completion | 25% | Live site, verified contracts, agent skill, `llms.txt`, working flows on a phone | M05, M07 |
| Innovation | 20% | No other entry lends on the ID or uses ID-to-ID social collateral (see section 6) | M03 |

Tie-break: depth of Agent ID use, then completion.

## 4. Requirements
- Contracts deployed on BNB Chain, source verified on BscScan, code public.
- Agent ID used in the core flow.
- Submit: project name, website, contract address(es), Agent ID usage description, other required materials, reward address. No registration step. ⚠ The exact form fields are behind the "Submit Project Now" button; spike S6 records them.
- Drive Agent ID holders to interact during the period.
- Listing on the Agent ID page ("List Your dApp") needs: a verified open-source contract on BNB Chain, Agent ID in the core flow, and a live product. Apply as soon as M04 is live.

## 5. Red lines (any one disqualifies)
1. No web QR-code or pairing-code sign-in for the Agentic Wallet on third-party sites; no storing login sessions on servers to act for users.
2. For anything touching user assets, the project's skills must not contain prompts that try to bypass the user's confirmation.
3. No unauthorised transfers: no scheduled collection, no automatic transfers to fixed addresses, no bundled extra transfers, no unlimited approvals without the user's knowledge.
4. Contracts open source with owner permissions disclosed (minting, tax changes, pausing, freezing, withdrawing user funds).
5. No impersonation of the Binance brand: no "Binance" or "BNB" in project, token or domain names.
6. No collecting seed phrases, private keys, API secrets or pairing codes.
7. No promised returns; "passive income" and "automatic money-making" are banned phrases.
8. Products involving trading must show risk warnings.
9. Agent ID must not be packaged as a tool for looking up other people's wallets by name.
10. No abnormal behaviour: volume manipulation, mass account registration, market manipulation.

How Rungs complies with each is in `00-context/05-feasibility-and-gaps.md` section 4.

## 6. Competitors seen on X (100 posts under #BinanceWalletHackathon, 2026-11-25)
| Group | Entries |
|---|---|
| Daily check-in, streak, badge | Agent Roll Call (several copies), AgentStreak, AgentTrail (161 agents on day 1), Agent Wall, Agent Pulse, Agent Passport, Agent ID Hub, AURA Agent Hub, StillAlive |
| Free mints, NFTs, launchpads | GLOOP (3,333, sold out), Tri333, AgentMint, Agent Grove, AgentMarket, Gang, ElysAgent, Contextgraph |
| Mint-safety registries | Mint Guardian, MintShield, Cek Aman, AgentShield |
| Quests and bounties | Agentic Quest, AgentID Quest Board, Agent Bounty Board, AgentRitual, AgentDrop |
| Other | AgentPulse (sybil filter), OneVoice (voting), Agent Jury (disputes), Agent Mandate (agent budget), SplitRoom (group split), StockSage (paid research), AgentWork Passport (job escrow), Forecast League, Abyss Raid, WickPet, TermiX |
| Already listed on the Agent ID page | Four.meme, Flap, Gang, Jager, Corla, Agentic Coin (all launch or mint gates) |

Nobody is lending on the ID. One holder asked for it in public: @Yizhimaobku1 on 2026-11-23 wrote that what they most want is the ID "turned into on-chain credit".

What the leading entries have in common, and we must match: a copy-paste prompt for the user's agent, an `llms.txt`, "gas only" messaging, a verified contract, and a public count of interacting agents.

## 7. Submission checklist
See `07-demo-and-submission/submission-checklist.md`.
