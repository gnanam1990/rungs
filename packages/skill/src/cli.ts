#!/usr/bin/env node
// Entry point for the `rungs` command. Read-only: a public RPC client, no wallet, no key.

import { BSC, type RawLog, makeClient, readSnapshot } from "@rungs/chain";
import { runCli } from "./commands";

const rpc = process.env.BSC_RPC_URL || "https://bsc-rpc.publicnode.com";
const pool = (process.env.RUNGS_POOL_ADDRESS || BSC.rungsPool || "") as `0x${string}`;

const client = makeClient(rpc);

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const needsPool = argv[0] === "line" || argv[0] === "calldata" || argv[0] === "explain";
  if (needsPool && !/^0x[0-9a-fA-F]{40}$/.test(pool)) {
    process.stderr.write("Rungs is not deployed yet, or RUNGS_POOL_ADDRESS is not set.\n");
    return 2;
  }
  return runCli(argv, {
    readSnapshot: (me, borrower) => readSnapshot(client, pool, me, borrower),
    receiptLogs: async (hash) => {
      const r = await client.getTransactionReceipt({ hash });
      return r.logs
        .filter((l) => l.address.toLowerCase() === pool.toLowerCase())
        .map((l) => ({ topics: l.topics, data: l.data }) as RawLog);
    },
    chainId: BSC.chainId,
    out: (s) => process.stdout.write(`${s}\n`),
    err: (s) => process.stderr.write(`${s}\n`),
  });
}

main().then(
  (code) => process.exit(code),
  (e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  },
);
