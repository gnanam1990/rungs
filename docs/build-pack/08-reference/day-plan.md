# Day plan (deadline-aware)

Hard deadline 2026-12-09 08:00 UTC. Internal finish **2026-12-08 18:00 UTC** (14 hours of buffer). Usage only counts inside the submission period, so the contract goes to mainnet on day 4.

| Day | Date | Work | Must be true at the end |
|---|---|---|---|
| 1 | Wed Nov 26 | M00; M01 spikes S1–S8 (owner's phone needed for S1, S2, S3, S7) | Plan A / F2 decided; a real contract call made from the owner's Agent ID |
| 2 | Thu Nov 27 | M02; start M03 (vectors test, `LadderLib`, open and draw) | Core merged |
| 3 | Fri Nov 28 | M03 (repay, write-off, vouch, admin, invariants, fork) | All contract tests green |
| 4 | Sat Nov 29 | M03 merge; M04 deploy, verify, fund 50 USDT; owner opens and draws | Verified contract live; first loan open |
| 5 | Sun Nov 30 | M05 skill, CLI, prompts; owner repays (24 h passed) | A stranger's agent could do it from the skill alone |
| 6 | Mon Dec 1 | M06 keeper; first invited holders (5–10 friends) | API live; first outside holders |
| 7 | Tue Dec 2 | M07 web (Home, Line, Agents) | Site live with real data |
| 8 | Wed Dec 3 | M07 (Ladder, Vouch, Open), e2e; listing application; first public post | **≥ 30 holders** target |
| 9 | Thu Dec 4 | M08 partner kit and a real vouch | Guide published |
| 10 | Fri Dec 5 | M09 security review; queue the cap raise | `SECURITY.md` done |
| 11 | Sat Dec 6 | M10 traction; fixes from real users | — |
| 12 | Sun Dec 7 | Execute the cap raise (2 days after queueing); record the video | Video done |
| 13 | Mon Dec 8 | README, write-up, submit by 18:00 UTC, tag `v0.1.0` | Submitted |
| — | Tue Dec 9 | Buffer until 08:00 UTC; keep the service up through the review period (to Dec 20) | — |

If a day slips, use `08-reference/cut-list.md` in order. Do not skip tests to catch up.
The owner has other deadlines in the same week; the agent should ask each morning how many hours are available and re-plan out loud.
