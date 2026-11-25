// Indexes RungsPool events into SQLite. getLogs in chunks from the deploy block, one request in flight, the chunk
// halves on an RPC error (spike S8), backoff between failures, and the last REORG_RESCAN_BLOCKS are fetched again
// every cycle and replaced, so a short reorg is corrected. The indexer is the only writer.

import { type RawLog, decodePoolLog } from "@rungs/chain";
import type { DB } from "./db";
import { rebuildDerived } from "./derive";

export interface LogEntry extends RawLog {
  blockNumber: bigint;
  logIndex: number;
  transactionHash: `0x${string}`;
}

/** The few chain reads the indexer needs; a viem PublicClient satisfies it, tests pass fakes. */
export interface ChainReader {
  getBlockNumber(): Promise<bigint>;
  getLogs(args: { address: `0x${string}`; fromBlock: bigint; toBlock: bigint }): Promise<LogEntry[]>;
  getBlock(args: { blockNumber: bigint }): Promise<{ timestamp: bigint; hash: `0x${string}` | null }>;
}

export interface IndexerOptions {
  pool: `0x${string}`;
  deployBlock: bigint;
  logChunk: bigint;
  reorgRescanBlocks: bigint;
  /** sleep between retries; tests pass a no-op */
  sleep?: (ms: number) => Promise<void>;
  maxRetries?: number;
}

/** Who acted (the transaction's sender as far as the event says) and whose line it concerns. */
function actorAndHolder(
  name: string,
  a: Record<string, unknown>,
): { holder: string | null; actor: string | null } {
  const s = (x: unknown) => (typeof x === "string" ? x.toLowerCase() : null);
  switch (name) {
    case "LineOpened":
    case "Drawn":
      return { holder: s(a.holder), actor: s(a.holder) };
    case "Repaid":
      return { holder: s(a.holder), actor: s(a.payer) };
    case "WrittenOff":
      return { holder: s(a.holder), actor: null };
    case "Vouched":
    case "Unvouched":
    case "Slashed":
    case "Restored":
      return { holder: s(a.holder), actor: s(a.voucher) };
    case "Claimed":
      return { holder: s(a.who), actor: s(a.who) };
    default:
      return { holder: null, actor: null };
  }
}

const argsJson = (args: Record<string, unknown>) =>
  JSON.stringify(args, (_, v) => (typeof v === "bigint" ? v.toString() : v));

export class Indexer {
  private chunk: bigint;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly times = new Map<bigint, bigint>();

  constructor(
    private readonly db: DB,
    private readonly chain: ChainReader,
    private readonly o: IndexerOptions,
  ) {
    this.chunk = o.logChunk;
    this.sleep = o.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  lastBlock(): bigint | null {
    const r = this.db.prepare("SELECT last_block FROM cursor WHERE id = 1").get() as
      | { last_block: number }
      | undefined;
    return r ? BigInt(r.last_block) : null;
  }

  private async retry<T>(f: () => Promise<T>, onError?: () => void): Promise<T> {
    const max = this.o.maxRetries ?? 8;
    for (let i = 0; ; i++) {
      try {
        return await f();
      } catch (e) {
        if (i >= max) throw e;
        onError?.();
        await this.sleep(Math.min(30_000, 250 * 2 ** i));
      }
    }
  }

  private async blockTime(n: bigint): Promise<bigint> {
    const t = this.times.get(n);
    if (t !== undefined) return t;
    const b = await this.retry(() => this.chain.getBlock({ blockNumber: n }));
    this.times.set(n, b.timestamp);
    if (this.times.size > 5_000) this.times.clear();
    return b.timestamp;
  }

  /** One indexing cycle up to the current head. Returns the head reached. */
  async cycle(): Promise<bigint> {
    const head = await this.retry(() => this.chain.getBlockNumber());
    const last = this.lastBlock();
    let from = last === null ? this.o.deployBlock : last - this.o.reorgRescanBlocks + 1n;
    if (from < this.o.deployBlock) from = this.o.deployBlock;
    const max = this.o.maxRetries ?? 8;
    while (from <= head) {
      let to = from;
      let logs: LogEntry[] | null = null;
      for (let attempt = 0; logs === null; attempt++) {
        to = from + this.chunk - 1n > head ? head : from + this.chunk - 1n;
        try {
          logs = await this.chain.getLogs({ address: this.o.pool, fromBlock: from, toBlock: to });
        } catch (e) {
          if (attempt >= max) throw e;
          if (this.chunk > 1n) this.chunk = this.chunk / 2n; // a range error or a rate limit: ask for less
          await this.sleep(Math.min(30_000, 250 * 2 ** attempt));
        }
      }
      const rows: unknown[][] = [];
      for (const l of logs) {
        const d = decodePoolLog(l);
        if (!d) continue;
        const { holder, actor } = actorAndHolder(d.name, d.args);
        const time = await this.blockTime(l.blockNumber);
        rows.push([
          Number(l.blockNumber),
          l.logIndex,
          l.transactionHash.toLowerCase(),
          Number(time),
          d.name,
          holder,
          actor,
          argsJson(d.args),
        ]);
      }
      const toBlock = await this.retry(() => this.chain.getBlock({ blockNumber: to }));
      const write = this.db.transaction(() => {
        this.db.prepare("DELETE FROM events WHERE block >= ? AND block <= ?").run(Number(from), Number(to));
        const ins = this.db.prepare(
          "INSERT INTO events (block, log_index, tx, time, name, holder, actor, json) VALUES (?,?,?,?,?,?,?,?)",
        );
        for (const r of rows) ins.run(...r);
        this.db
          .prepare(
            "INSERT INTO cursor (id, last_block, last_hash) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET last_block = excluded.last_block, last_hash = excluded.last_hash",
          )
          .run(Number(to), toBlock.hash ?? "");
      });
      write();
      from = to + 1n;
    }
    rebuildDerived(this.db);
    return head;
  }

  /** Drops everything and indexes again from the deploy block. */
  async replay(): Promise<bigint> {
    this.db.exec("DELETE FROM events; DELETE FROM cursor;");
    return this.cycle();
  }

  currentChunk(): bigint {
    return this.chunk;
  }
}
