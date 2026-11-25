# Research evidence

Full research report: `hackathon-db/reports/20261125-binance-agent-id-hackathon-ideas.md` in the owner's Hackathon Atlas folder. The parts a builder needs are below.

## 1. The problem
- **1.4 billion adults have no account** at a bank or mobile-money provider, and in low- and middle-income economies about as many borrowers borrow only from family or friends as from formal sources (World Bank, Global Findex 2025: https://www.worldbank.org/en/publication/globalfindex/report and https://www.worldbank.org/en/topic/financialinclusion/overview.print). In Ghana, Kenya and Uganda more than 20% of adults borrowed from a mobile-money provider in 2024 (same report), which shows that small, phone-first, history-based credit is what people actually take up.
- **On-chain credit asks for more collateral than the loan.** A wallet costs nothing to replace, so a default has no lasting cost. The Hackathon Atlas database shows how often teams try to fix this: 844 submissions touch identity-based or under-collateralised credit, 344 of them in 2026, with a winner rate of 18.6% against a 15.3% baseline. Almost all of them build a score from wallet history, which a new wallet resets.
- **Agent ID changes the missing piece.** It is one per Binance account, cannot be transferred, renamed or duplicated, and 270,061 were claimed by 2026-11-25. The Agent ID page describes it as "One name. One verified human." (https://web3.binance.com/agent-id). A default recorded against it cannot be walked away from without giving up the name.
- **Holders are asking for it.** @Yizhimaobku1, 2026-11-23 (translated): "I have an .ai Agent ID, and what I most want to see is it turned into on-chain credit". Find it under https://x.com/search?q=%23BinanceWalletHackathon&f=live.
- **The current uses are shallow.** In the same feed, more than ten entries are a daily check-in for a badge, and @quant_web's agent claimed across 60+ Agent ID mints in a week. Another entrant reports that 8 of 12 sampled IDs were dormant shells. Holders have an identity and nothing serious to do with it.

## 2. Why this is not a sponsor feature
| Sponsor feature | What it does | Why Rungs is different |
|---|---|---|
| Agentic Wallet daily limits | Caps what the user's own agent can spend of the user's own money | Rungs lends money the user does not have |
| DeFi deposit / lending positions | Over-collateralised protocols through verified integrations | No collateral; the limit comes from repayment history on the ID |
| Agent ID registry | Says who holds which name | Rungs adds what that name has borrowed and repaid |
| ERC-8183 job escrow (BNB Agent Studio) | Holds a buyer's payment for an agent's job | Not credit; no standing over time |
| x402 / B402 | Pay per request | Unrelated; could later be a place to spend a line |

Rails we use and do not rebuild: the registry's `balanceOf` and `handleOf`, the wallet's Developer Mode contract calls, USDT.

## 3. Prior art in the database (178,712 unique ideas)
- "undercollateralized credit identity reputation loan": 21 core matches, 4 winners → **LIGHT**. The surrounding "credit score" space is crowded (148 projects, 25% win rate), so do not pitch a score. Pitch a **ladder on a non-transferable name**.
- Agent identity in 2026 was mostly ENS-based naming and reputation layers (Skillname, Vouch, ReputAI, Agents Scan, Try Mandate). None lends.
- The owner's `MY_STACK.md` notes that "agent credit against receivables" is crowded (CashETH and Lifeline won in November 2026). Rungs is personal credit with no receivable, which is a different product.
- Name check: no project named "Rungs" in the database.

## 4. Honest limits of the idea
- A first rung of 1 USDT helps nobody pay rent. The product is the record; the money grows with it. Say so.
- "One verified human" is Binance's claim. People can hold several Binance accounts, and accounts are sold. The design bounds the damage instead of trusting the claim: a tiny first rung, a daily cap on new lines, and a 24-hour hold before a repayment counts.
- Lending is regulated in many countries. This is a small, experimental, non-custodial pilot funded by its own team, with no interest-bearing deposits from the public. The owner decides where it is offered.
