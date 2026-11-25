# Glossary

| Term | Meaning |
|---|---|
| Agent ID | A non-transferable ERC-721 name (`name.ai`) on BNB Chain, one per Binance account, issued by the `HandleRegistry` contract at `0x60b9262456de011f7d15a54cdd8c48baaa8b022f` |
| Handle | The name without `.ai`, 3–20 lowercase letters or digits on-chain |
| Labelhash | `keccak256(bytes(handle))`; also the token id |
| Agentic Wallet | Binance's MPC wallet that an AI agent operates within limits the user sets in the Binance App |
| `baw` | The Agentic Wallet command-line tool the agent runs |
| Developer Mode | The App switch that lets the agent make custom contract calls, with preview and confirmation; lasts 7 days |
| Holder | An address that holds an Agent ID |
| Line | A holder's account in Rungs: rung, counters, frozen flag |
| Rung / level | Position on the ladder, 0 to 6; sets the limit |
| Draw | Borrowing from the line |
| Term / grace | 7 days to repay; then 3 more days before a write-off is possible |
| Minimum hold | 24 hours; a loan repaid sooner does not count towards promotion |
| Outcome | What a repayment did: early, small, on time, promoted, late, cured |
| Write-off | Marking an unpaid loan as lost after grace; anyone can trigger it |
| Cure | Paying a written-off loan later; unfreezes the line at rung 0 |
| Probation | After a default, two or three qualifying repayments are needed per rung |
| Vouch / stake | USDT a holder locks behind another holder; raises their limit; lost first on default |
| Idle | Pool capital available to lend |
| Reserve | First-loss buffer built from fees |
| Socialised loss | The part of a write-off not covered by stakes or reserve |
| Standing | The public summary other apps read: has line, level, counts, frozen, open loan |
| Keeper | Our read-only indexer and API |
| Red lines | The hackathon's ten disqualifying rules |
| Pioneer / Innovation | The two awards: on-chain usage ranking / judged score |
