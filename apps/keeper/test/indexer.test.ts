import { describe, expect, it } from "vitest";
import { derivedHash, openDb } from "../src/db";
import { Indexer } from "../src/indexer";
import { FakeChain, POOL } from "./fake-chain";

const U = 10n ** 18n;
const A = "0x00000000000000000000000000000000000000a1";
const B = "0x00000000000000000000000000000000000000b0";

function seed(chain: FakeChain) {
  chain.add(10n, "LineOpened", { holder: A, labelhash: `0x${"11".repeat(32)}`, handle: "dewi" });
  chain.add(12n, "Drawn", {
    holder: A,
    principal: U,
    fee: U / 100n,
    dueAt: 1_800_604_800n,
    level: 0,
    vouched: 0n,
  });
  chain.add(30n, "LineOpened", { holder: B, labelhash: `0x${"22".repeat(32)}`, handle: "arun" });
  chain.add(40_000n, "Repaid", {
    holder: A,
    payer: A,
    principal: U,
    fee: U / 100n,
    lateFee: 0n,
    outcome: 3,
    newLevel: 1,
  });
}

const make = (chain: FakeChain, chunk = 5_000n) => {
  const db = openDb(":memory:");
  const ix = new Indexer(db, chain, {
    pool: POOL,
    deployBlock: 1n,
    logChunk: chunk,
    reorgRescanBlocks: 30n,
    sleep: async () => {},
  });
  return { db, ix };
};

const count = (db: ReturnType<typeof openDb>) =>
  (db.prepare("SELECT COUNT(*) n FROM events").get() as { n: number }).n;

describe("indexer on a fake chain", () => {
  it("indexes every event once and derives the line", async () => {
    const chain = new FakeChain();
    seed(chain);
    const { db, ix } = make(chain);
    await ix.cycle();
    expect(count(db)).toBe(4);
    const line = db.prepare("SELECT * FROM lines WHERE holder = ?").get(A.toLowerCase()) as Record<
      string,
      number
    >;
    expect(line.level).toBe(1);
    expect(line.repaid).toBe(1);
    await ix.cycle(); // the re-scan window is fetched again: still no duplicates
    expect(count(db)).toBe(4);
  });

  it("T-S03 reorg: replaced blocks inside the re-scan window are corrected", async () => {
    const chain = new FakeChain();
    seed(chain);
    chain.add(40_010n, "Vouched", { voucher: A, holder: B, amount: 3n * U });
    const { db, ix } = make(chain);
    await ix.cycle();
    expect((db.prepare("SELECT amount FROM stakes").get() as { amount: string }).amount).toBe(
      (3n * U).toString(),
    );
    // the vouch block is replaced by a fork where it never happened, and something else did
    chain.reorgFrom(40_005n);
    chain.add(40_006n, "Vouched", { voucher: A, holder: B, amount: 2n * U });
    chain.head = 40_012n;
    await ix.cycle();
    const rows = db.prepare("SELECT name, block FROM events WHERE name = 'Vouched'").all();
    expect(rows).toEqual([{ name: "Vouched", block: 40_006 }]);
    expect((db.prepare("SELECT amount FROM stakes").get() as { amount: string }).amount).toBe(
      (2n * U).toString(),
    );
  });

  it("T-S04 range limits and rate limits: chunk halves, backoff, no gaps, no duplicates", async () => {
    const chain = new FakeChain();
    seed(chain);
    chain.maxRange = 700n; // like a public RPC that refuses big ranges
    chain.failNext = 2; // and a couple of rate-limit errors
    const { db, ix } = make(chain, 5_000n);
    await ix.cycle();
    expect(ix.currentChunk()).toBeLessThanOrEqual(700n);
    expect(count(db)).toBe(4);
    const refChain = new FakeChain();
    seed(refChain);
    const r = make(refChain);
    await r.ix.cycle();
    expect(derivedHash(db)).toBe(derivedHash(r.db));
  });

  it("gives up after too many failures without writing a partial chunk", async () => {
    const chain = new FakeChain();
    seed(chain);
    chain.failNext = 100;
    const { db, ix } = make(chain);
    await expect(ix.cycle()).rejects.toThrow(/rate limited/);
    expect(count(db)).toBe(0);
  });

  it("T-S02 replay from zero gives byte-identical derived tables", async () => {
    const chain = new FakeChain();
    seed(chain);
    const { db, ix } = make(chain);
    await ix.cycle();
    const before = derivedHash(db);
    await ix.replay();
    expect(derivedHash(db)).toBe(before);
  });
});
