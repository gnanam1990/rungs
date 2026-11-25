// A fake chain for indexer tests: logs keyed by block, a range limit like a public RPC, injectable failures.

import { rungsPoolAbi } from "@rungs/chain";
import { encodeAbiParameters, encodeEventTopics, keccak256, toHex } from "viem";
import type { ChainReader, LogEntry } from "../src/indexer";

export const POOL = "0x00000000000000000000000000000000000000f0" as const;

export function poolLog(
  eventName: string,
  args: Record<string, unknown>,
): { topics: `0x${string}`[]; data: `0x${string}` } {
  const ev = rungsPoolAbi.find((x) => x.type === "event" && x.name === eventName) as {
    inputs: readonly { name: string; type: string; indexed?: boolean }[];
  };
  const topics = encodeEventTopics({
    abi: rungsPoolAbi,
    // biome-ignore lint/suspicious/noExplicitAny: test encoder over any event name
    eventName: eventName as any,
    // biome-ignore lint/suspicious/noExplicitAny: as above
    args: args as any,
  }) as `0x${string}`[];
  const nonIndexed = ev.inputs.filter((i) => !i.indexed);
  const data = encodeAbiParameters(
    nonIndexed,
    nonIndexed.map((i) => args[i.name]),
  );
  return { topics, data };
}

export class FakeChain implements ChainReader {
  head = 0n;
  logs = new Map<bigint, LogEntry[]>();
  /** largest getLogs range accepted, like "limit exceeded" on a public RPC */
  maxRange = 1_000_000n;
  /** fail the next N getLogs calls */
  failNext = 0;
  getLogsCalls = 0;
  fork = 0;

  add(block: bigint, name: string, args: Record<string, unknown>): void {
    const list = this.logs.get(block) ?? [];
    const l = poolLog(name, args);
    list.push({
      ...l,
      blockNumber: block,
      logIndex: list.length,
      transactionHash: keccak256(toHex(`${this.fork}:${block}:${list.length}:${name}`)),
    });
    this.logs.set(block, list);
    if (block > this.head) this.head = block;
  }

  /** Replace everything from `block` on, like a reorg. */
  reorgFrom(block: bigint): void {
    this.fork++;
    for (const b of [...this.logs.keys()]) if (b >= block) this.logs.delete(b);
  }

  async getBlockNumber(): Promise<bigint> {
    return this.head;
  }

  async getLogs({ fromBlock, toBlock }: { address: `0x${string}`; fromBlock: bigint; toBlock: bigint }) {
    this.getLogsCalls++;
    if (this.failNext > 0) {
      this.failNext--;
      throw new Error("rate limited");
    }
    if (toBlock - fromBlock + 1n > this.maxRange) throw new Error("limit exceeded");
    const out: LogEntry[] = [];
    for (let b = fromBlock; b <= toBlock; b++) out.push(...(this.logs.get(b) ?? []));
    return out;
  }

  async getBlock({ blockNumber }: { blockNumber: bigint }) {
    return {
      timestamp: 1_800_000_000n + blockNumber * 3n,
      hash: keccak256(toHex(`${this.fork}:${blockNumber}`)),
    };
  }
}
