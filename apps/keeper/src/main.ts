// Runs the keeper: the indexer loop and the read API in one small process.

import { serve } from "@hono/node-server";
import { makeClient } from "@rungs/chain";
import { openDb, setTeam } from "./db";
import { loadConfig } from "./env";
import { type ChainReader, Indexer } from "./indexer";
import { createApp } from "./server";

const config = loadConfig();
const db = openDb(config.dbPath);
setTeam(db, config.teamWallets);
const client = makeClient(config.rpcUrl);

const app = createApp({ db, client, config });
serve({ fetch: app.fetch, port: config.port });
console.log(`keeper listening on :${config.port}; pool ${config.pool ?? "not deployed"}`);

if (config.pool) {
  const indexer = new Indexer(db, client as unknown as ChainReader, {
    pool: config.pool,
    deployBlock: config.deployBlock,
    logChunk: config.logChunk,
    reorgRescanBlocks: config.reorgRescanBlocks,
  });
  if (process.argv.includes("--replay")) {
    await indexer.replay();
    console.log("replayed from the deploy block");
  }
  let busy = false;
  const tick = async () => {
    if (busy) return; // one request in flight
    busy = true;
    try {
      const head = await indexer.cycle();
      console.log(`indexed to ${head}`);
    } catch (e) {
      console.error(`index cycle failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      busy = false;
    }
  };
  await tick();
  setInterval(tick, config.cycleSeconds * 1000);
}
