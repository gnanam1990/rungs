// Local development: anvil with the real RungsPool (mock USDT and registry), a seeded scenario, and the keeper on
// :8787. No keys: anvil's unlocked dev accounts send the transactions. Prints the addresses to open in the web app.
// Usage: pnpm --filter @rungs/keeper dev:local

import { serve } from "@hono/node-server";
import { rungsPoolAbi } from "@rungs/chain";
import { startLocalChain } from "@rungs/chain/testing";
import { openDb, setTeam } from "../src/db";
import { loadConfig } from "../src/env";
import { type ChainReader, Indexer } from "../src/indexer";
import { createApp } from "../src/server";

const U = 10n ** 18n;
const c = await startLocalChain({ handles: ["dewi", "arun", "mira", "kofi"] });
const [dewi, arun, mira, kofi] = c.holders as [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`];

const repay = async (who: `0x${string}`) => {
  const [amount] = (await c.client.readContract({
    address: c.pool,
    abi: rungsPoolAbi,
    functionName: "dueOf",
    args: [who],
  })) as readonly [bigint, bigint, number];
  await c.approve(who, amount);
  await c.call(who, "repay");
};

// arun climbs to rung 2 and vouches for mira; dewi reaches rung 1 and has a loan open; kofi has a fresh line
await c.call(arun, "openLine");
for (const amt of [U, 2n * U]) {
  await c.call(arun, "draw", [amt]);
  await c.warp(86_400);
  await repay(arun);
}
await c.call(dewi, "openLine");
await c.call(dewi, "draw", [U]);
await c.warp(86_400);
await repay(dewi);
await c.call(mira, "openLine");
await c.approve(arun, 3n * U);
await c.call(arun, "vouch", [mira, 3n * U]);
await c.call(kofi, "openLine");
await c.call(dewi, "draw", [2n * U]);

const config = {
  ...loadConfig(),
  chainId: 31337,
  pool: c.pool,
  deployBlock: c.deployBlock,
  rpcUrl: c.url,
};
const db = openDb(":memory:");
setTeam(db, config.teamWallets);
const ix = new Indexer(db, c.client as unknown as ChainReader, {
  pool: c.pool,
  deployBlock: c.deployBlock,
  logChunk: 1000n,
  reorgRescanBlocks: 5n,
});
await ix.cycle();
setInterval(() => ix.cycle().catch((e) => console.error(e)), 3_000);

const app = createApp({ db, client: c.client, config });
serve({ fetch: app.fetch, port: config.port });
console.log(
  JSON.stringify(
    {
      keeper: `http://localhost:${config.port}`,
      rpc: c.url,
      pool: c.pool,
      holders: { dewi, arun, mira, kofi },
      noAgentId: c.stranger,
    },
    null,
    2,
  ),
);
process.on("SIGINT", () => {
  c.stop();
  process.exit(0);
});
