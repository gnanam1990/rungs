# M04 — Mainnet canary

Deploy early. Only activity inside the submission period counts, and holders need days to climb.

## Goal
`RungsPool` live and verified on BNB Chain with tiny caps, funded with a small amount, and one real loan cycle done by the owner's own Agent ID.

## Steps
1. Dry run on a mainnet fork: deploy, set caps, fund, open, draw, repay. Record gas.
2. [HUMAN] Fund the deployer with about 0.01 BNB. [HUMAN] Confirm the owner address (a wallet the owner controls; not the deployer if the owner prefers).
3. [HUMAN approval] `forge script script/Deploy.s.sol --rpc-url $BSC_RPC_URL --broadcast` with: `USDT`, `REGISTRY`, `OWNER`, initial `maxOutstanding = 50 USDT`, `dailyNewLineCap = 20`.
4. Verify on BscScan with the command proven in S5; also Sourcify. Confirm the "Contract" tab shows verified source.
5. [HUMAN] `fund(50 USDT)` from the owner (approve exactly 50 first).
6. Write the address and deploy block into `packages/chain/src/addresses.ts` and `08-reference` copies in the repo docs.
7. [HUMAN] T-E02: the owner's agent opens the line and draws 1 USDT. After 24 hours it approves exactly the due amount and repays. Record every hash.
8. Generate `OWNER-PERMISSIONS.md` final text and copy it into the README.
9. [HUMAN] Apply for the Agent ID directory listing ("List Your dApp") as soon as the site from M07 is up; note it here if it must wait.

## Tests first
T-E03 as an `eth_call` simulation script; a script that reads back caps, owner, paused, `idle` and compares with the intended values.

## Definition of Done
- [ ] Address, deploy block, verification link and all hashes in `PROVEN.md`
- [ ] Read-back script passes
- [ ] The owner's loan cycle is complete (the repay step may land a day later; record it then)
- [ ] README states: live on mainnet, unaudited, caps, pool size, owner permissions

## Ship it
Branch `m04-mainnet-canary` → pull request with the dry-run log first → after approval and deployment, add evidence → checks green → squash merge.
