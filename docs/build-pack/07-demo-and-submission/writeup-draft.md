# Write-up draft

**Project name:** Rungs

**One line:** A credit ladder on the Agent ID: borrow a little with no collateral, repay on time, and your name's limit climbs.

**Problem.** On-chain loans need more collateral than the loan, because a borrower who defaults just opens a new wallet. So people with no assets and no history cannot start. Agent ID gives each person one name that cannot be moved or replaced, and today it is used mostly as a gate for mints and check-ins.

**What Rungs does.** A holder opens a line and borrows 1 USDT. Repaying within 7 days, after holding at least 24 hours, moves them up a rung: 2, 5, 10, 20, 35, 50 USDT. The fee is a flat 1%. A missed repayment is written off, sends the holder back to the first rung and stays on their record. Holders in good standing can stake USDT behind someone else; the stake raises that person's limit and is lost first on default. Any app can read a holder's standing with one call.

**How Agent ID is used (depth).**
- Holding an Agent ID is the only requirement to borrow, checked on-chain at open and at every draw.
- The line stores the hash of the handle and emits the handle, so the record belongs to the name.
- The ID's two properties, one per person and non-transferable, are what make an unsecured loan rational. Without them the product cannot exist.
- Vouching is ID to ID: only holders in good standing can back another holder.
- `standingOf(address)` lets other Agent ID apps gate on repayment history, not only on holding an ID.

**Agent in the loop.** The holder's own AI agent reads our skill file, prepares each call, shows a preview with amount, fee and due date, and waits for the holder's yes. Rungs never collects automatically, holds no session and asks for no secret.

**Safety and honesty.** Verified, open-source, non-upgradeable contract. The owner can pause new loans, fund or withdraw unlent capital, and change two caps, with raises delayed 2 days. The owner cannot touch stakes or change an open loan. Loss is bounded by a total cap and a daily cap on new lines. Unaudited; pool size and loss by rung are public.

**What is live.** {site URL} · contract {address} (verified) · {N} Agent ID holders, {loans} loans, {repaid} repaid on time, {writtenOff} written off, as of block {block}.

**What is not.** No audit. Small pool funded by the team. The first rungs are too small to matter financially; the record is the product. The identity guarantee is Binance's one-per-account rule, which we bound with caps and do not rely on.

**Built with.** Solidity (Foundry), TypeScript, viem, Hono, SQLite, React + Vite. Repo: https://github.com/gnanam1990/rungs

Fill every `{…}` from `/v1/stats` and `PROVEN.md` at submission time. Do not round up.
