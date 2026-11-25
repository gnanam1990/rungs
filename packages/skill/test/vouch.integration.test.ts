import { readSnapshot, rungsPoolAbi } from "@rungs/chain";
import { type LocalChain, anvilBinary, startLocalChain } from "@rungs/chain/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runCli } from "../src/index";

const U = 10n ** 18n;

// T-G03: the whole vouch flow on a real chain (local anvil, real RungsPool), every call built by `rungs calldata`.
describe.runIf(anvilBinary() !== null)("T-G03 vouch end to end through the CLI's calldata", () => {
  let c: LocalChain;
  beforeAll(async () => {
    c = await startLocalChain();
  }, 60_000);
  afterAll(() => c?.stop());

  /** runs `rungs calldata …` and sends exactly what it printed, from `from` */
  const cli = async (from: `0x${string}`, args: string[]) => {
    const out: string[] = [];
    const err: string[] = [];
    const code = await runCli(["calldata", ...args, "--from", from, "--json"], {
      readSnapshot: (me, b) => readSnapshot(c.client, c.pool, me, b),
      receiptLogs: async () => [],
      chainId: 31337,
      out: (s) => out.push(s),
      err: (s) => err.push(s),
    });
    const r = JSON.parse(out.join(""));
    if (code !== 0 || !r.ok) throw new Error(`${args.join(" ")}: ${r.code} ${r.reason}`);
    await c.send(from, r.to, r.data);
    return r;
  };
  const standing = (who: `0x${string}`) =>
    c.client.readContract({ address: c.pool, abi: rungsPoolAbi, functionName: "standingOf", args: [who] });

  it("climb to rung 2, vouch, borrower draws with the stake, repays, voucher takes the stake back", async () => {
    const [arun, mira] = c.holders as [`0x${string}`, `0x${string}`];
    await cli(arun, ["open"]);
    for (const amt of ["1", "2"]) {
      await cli(arun, ["draw", "--amount", amt]);
      await c.warp(86_400);
      await cli(arun, ["approve"]);
      await cli(arun, ["repay"]);
    }
    expect((await standing(arun)).level).toBe(2);

    await cli(mira, ["open"]);
    const approve = await cli(arun, ["approve", "--purpose", "vouch", "--amount", "3", "--borrower", mira]);
    expect(approve.humanSummary).toBe("This approval is for exactly 3 USDT, for this one stake.");
    const v = await cli(arun, ["vouch", "--amount", "3", "--borrower", mira]);
    expect(v.humanSummary).toMatch(/your stake is taken first/);

    // mira's limit is now 1 + 3
    const s = await readSnapshot(c.client, c.pool, mira);
    expect(s.me.vouchedFor).toBe(3n * U);
    await cli(mira, ["draw", "--amount", "4"]);

    // the stake is locked while mira's loan is open: the CLI refuses before any transaction
    await expect(cli(arun, ["unvouch", "--amount", "3", "--borrower", mira])).rejects.toThrow(/StakeLocked/);

    await c.warp(86_400);
    await cli(mira, ["approve"]);
    await cli(mira, ["repay"]);
    expect((await standing(mira)).level).toBe(1);

    const before = (await readSnapshot(c.client, c.pool, arun)).pool.totalStaked;
    expect(before).toBe(3n * U);
    await cli(arun, ["unvouch", "--amount", "3", "--borrower", mira]);
    expect((await readSnapshot(c.client, c.pool, arun)).pool.totalStaked).toBe(0n);
  });
});
