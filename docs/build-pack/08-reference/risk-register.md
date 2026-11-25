# Risk register

| # | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R1 | Developer Mode blocks or scares users on our calls (approve especially) | Medium | High | Spikes S1, S2 on day 1; fallback F2 repay box; clear guide; verified contract | M01 |
| R2 | Farmed or bought IDs take the first rung and never repay | High | Low per ID | 1 USDT first rung; `dailyNewLineCap`; `maxOutstanding`; loss by rung public | M03, M09 |
| R3 | A rule is read as "promise of returns" or "lookup tool" and the entry is disqualified | Low | Fatal | No public deposits; banned-phrase tests; no name search; red-line re-check | M07, M09 |
| R4 | Contract bug loses stakes or pool | Low | High | Small caps, invariants, fork tests, self-audit, non-upgradeable, tiny funding first | M03, M09 |
| R5 | Fewer than 30 holders | Medium | High (Innovation bar) | Deploy on day 4; simple offer; prompt; daily posts; friends first | M10 |
| R6 | Pool runs dry and holders are turned away | Medium | Medium | Daily watch; honest notice; timelocked raise queued early | M09, M10 |
| R7 | Looks like volume manipulation | Low | Fatal | 24 h rule; team wallets flagged; never ask users to cycle | M02, M10 |
| R8 | Owner key compromise | Low | Medium | Attacker gets only `idle`; raises delayed 2 days; stakes untouchable; documented | M03 |
| R9 | Lending regulation in a user's country | Medium | Medium | Pilot scale, no public deposits, region list, risk notice; owner's call | M06 |
| R10 | Registry owner mints IDs at will | Low | Low | Caps; stated as a trust assumption | README |
| R11 | Keeper down | Medium | Low | Contract and CLI work without it; site says so | M06 |
| R12 | Holder lacks 0.01 USDT for the fee or BNB for gas | High | Low | Say it before the first draw; repay-for-a-friend path | M05, M07 |
| R13 | Owner has too little time (other deadlines) | High | High | Cut list; day plan re-planned daily | all |
| R14 | Brand confusion with Binance | Low | High | Own mark, independence line, no logo, domain check | M07 |
