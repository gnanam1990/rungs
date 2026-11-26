# Mainnet runbook (M01 spikes left + M04 canary)

Everything here needs **you** (the owner): your phone, your Binance App, your wallets, your keys. The coding agent never sees a key, seed phrase, pairing code or QR. Run commands from the repo root on your own machine. Each step says what to record in `PROVEN.md`.

Contract code is final for the canary: `main` after M09. Do not deploy from a branch.

## 0. Before anything
- [ ] Decide the **owner address**: a wallet you control directly (not an exchange account). It receives `defund` and holds the owner role.
- [ ] Create a **deployer** wallet that only pays gas. Fund it with about 0.01 BNB. After the deploy it holds nothing.
- [ ] Create a BscScan (Etherscan V2) API key for verification.
- [ ] `cp .env.example .env` and fill `DEPLOYER_PRIVATE_KEY`, `OWNER_ADDRESS`, `BSCSCAN_API_KEY`. `.env` is git-ignored. Never paste it anywhere.

## 1. Spikes S1 and S2 (decide Plan A before deploying the pool)
Deploy the throw-away spike contracts (not part of the product):
```bash
cd contracts
forge create spikes/Ping.sol:Ping --rpc-url $BSC_RPC_URL --private-key $DEPLOYER_PRIVATE_KEY --broadcast
forge create spikes/Pull.sol:Pull --constructor-args 0x55d398326f99059fF775485246999027B3197955 --rpc-url $BSC_RPC_URL --private-key $DEPLOYER_PRIVATE_KEY --broadcast
```
- **S5** verify both: `forge verify-contract --chain 56 --verifier etherscan --etherscan-api-key $BSCSCAN_API_KEY <address> spikes/Ping.sol:Ping` (for `Pull`, add `--constructor-args $(cast abi-encode "constructor(address)" 0x55d398326f99059fF775485246999027B3197955)`). Record the exact command that worked.
- **S1** in the Binance App, turn on Developer Mode. From your agent: `baw wallet settings --json`, `baw wallet address --json`, then `baw contract-call preview --binanceChainId 56 --from <your agentic wallet> --to <Ping> --value 0 --inputData 0x5c36b186 --json`, show the preview, `execute`. Record `requireConfirmation`, the risk lines, the tx hash.
- **S2** approve exactly 0.01 USDT to `Pull` (`approve(<Pull>, 10000000000000000)`), then call `pull()` (`0x329eb839`). Record whether the approve previewed cleanly, with a warning, or was blocked (`351803`).
  - Clean or a warning → **Plan A** stands (already built).
  - Blocked → tell the agent "S2 failed": fallback F2 (repay box) must be built before the pool goes live.
- **S3** paste a prompt into Binance AI Pro; **S6** open the submission and "List Your dApp" forms and copy the fields (do not submit); **S7** note `devMode.dailyLimit` and the balance cap.

## 2. Deploy the pool
```bash
cd contracts
forge script script/Deploy.s.sol --rpc-url $BSC_RPC_URL --private-key $DEPLOYER_PRIVATE_KEY --broadcast
forge verify-contract --chain 56 --verifier etherscan --etherscan-api-key $BSCSCAN_API_KEY \
  --constructor-args $(cast abi-encode "constructor(address,address,address)" $USDT_ADDRESS $AGENT_ID_REGISTRY $OWNER_ADDRESS) \
  <pool address> src/RungsPool.sol:RungsPool
```
Record the address, the deploy block and the BscScan "Contract ✓" link. Also push to Sourcify: `forge verify-contract --chain 56 --verifier sourcify <pool address> src/RungsPool.sol:RungsPool`.

## 3. Owner setup (from the owner wallet)
```bash
cast send <pool> "setCaps(uint256,uint32)" 50000000000000000000 20 --rpc-url $BSC_RPC_URL   # sign with the owner wallet
cast send 0x55d398326f99059fF775485246999027B3197955 "approve(address,uint256)" <pool> 50000000000000000000 --rpc-url $BSC_RPC_URL
cast send <pool> "fund(uint256)" 50000000000000000000 --rpc-url $BSC_RPC_URL
```
(Sign with whatever the owner wallet supports; the approval is for exactly 50 USDT.)

## 4. Check it
```bash
RUNGS_POOL_ADDRESS=<pool> EXPECTED_IDLE=50000000000000000000 forge script script/ReadBack.s.sol --rpc-url $BSC_RPC_URL
RUNGS_POOL_ADDRESS=<pool> scripts/simulate-nonholder.sh        # T-E03, eth_call only
```
Both must print OK.

## 5. Point the code at the pool
Tell the agent the address and deploy block. It updates `packages/chain/src/addresses.ts` (`rungsPool`, `rungsPoolDeployBlock`), `.env.example`, and the README "What is live" section in an `m04-mainnet-canary` pull request.

## 6. First real loan (T-E02)
With your own Agent ID and Developer Mode on, paste the **open** prompt, then the **draw** prompt for 1 USDT. Wait **at least 24 hours**, then the **repay** prompt (approve exactly 1.01, then repay). Record every hash. The site should then show rung 1.

## 7. Host the keeper and the site (one service)
The `Dockerfile` at the repo root builds one image: the keeper also serves the site, `/llms.txt` and `/skill.md` on the same domain. CI builds and starts it on every pull request.
- Pick a host that builds from a Dockerfile (Railway, Fly or a VPS) and create the account yourself. The domain must not contain "binance" or "bnb".
- Build argument: `PUBLIC_URL=https://<your domain>` (no trailing slash).
- Volume: mount one at `/data` (SQLite lives there).
- Environment: `RUNGS_POOL_ADDRESS`, `RUNGS_POOL_DEPLOY_BLOCK`, `BSC_RPC_URL` (a keyed RPC is better), `TEAM_WALLETS`. Nothing secret: **never** put `DEPLOYER_PRIVATE_KEY` or `BSCSCAN_API_KEY` in the host's settings.
- Check: open `https://<your domain>/`, `/open`, `/llms.txt`, `/skill.md` and `/v1/stats` on your phone.
- Then: replay twice and record `pnpm --filter @rungs/keeper derived-hash` both times (M06 DoD); apply for "List Your dApp".
