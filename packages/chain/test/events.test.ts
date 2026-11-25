import { encodeAbiParameters, encodeEventTopics } from "viem";
import { describe, expect, it } from "vitest";
import { decodePoolLog, explainEvent, rungsPoolAbi } from "../src/index";

const U = 10n ** 18n;
const A = "0x00000000000000000000000000000000000000a1" as const;
const B = "0x00000000000000000000000000000000000000b0" as const;

// biome-ignore lint/suspicious/noExplicitAny: building raw logs for the decoder
function log(eventName: string, args: Record<string, unknown>): { topics: any; data: `0x${string}` } {
  const ev = rungsPoolAbi.find((x) => x.type === "event" && x.name === eventName) as {
    inputs: readonly { name: string; type: string; indexed?: boolean }[];
  };
  // biome-ignore lint/suspicious/noExplicitAny: as above
  const topics = encodeEventTopics({ abi: rungsPoolAbi, eventName: eventName as any, args: args as any });
  const nonIndexed = ev.inputs.filter((i) => !i.indexed);
  const data = encodeAbiParameters(
    nonIndexed,
    nonIndexed.map((i) => args[i.name]),
  );
  return { topics, data };
}

const sentence = (name: string, args: Record<string, unknown>) => {
  const d = decodePoolLog(log(name, args));
  expect(d).not.toBeNull();
  return explainEvent(d!);
};

describe("T-K04 explain: one plain sentence per event", () => {
  it("LineOpened keeps the handle as data", () => {
    expect(
      sentence("LineOpened", {
        holder: A,
        labelhash: "0x1111111111111111111111111111111111111111111111111111111111111111",
        handle: "dewi",
      }),
    ).toBe("0x0000…00a1 opened a line as dewi.ai.");
    expect(
      sentence("LineOpened", {
        holder: A,
        labelhash: "0x1111111111111111111111111111111111111111111111111111111111111111",
        handle: "x\u0007y",
      }),
    ).toBe("0x0000…00a1 opened a line as x?y.ai.");
  });
  it("Drawn", () => {
    expect(
      sentence("Drawn", {
        holder: A,
        principal: U,
        fee: U / 100n,
        dueAt: 1_800_604_800n,
        level: 0,
        vouched: 0n,
      }),
    ).toBe("0x0000…00a1 borrowed 1 USDT at rung 0 (fee 0.01 USDT), due Fri 22 Jan 2027, 08:00 UTC.");
  });
  it("Repaid, each outcome", () => {
    const base = { holder: A, payer: A, principal: U, fee: U / 100n, lateFee: 0n, newLevel: 0 };
    expect(sentence("Repaid", { ...base, outcome: 0 })).toBe(
      "0x0000…00a1 repaid 1 USDT plus 0.01 USDT fee: held under 24 hours, so it does not count towards the next rung.",
    );
    expect(sentence("Repaid", { ...base, outcome: 1 })).toMatch(/under half the rung's limit/);
    expect(sentence("Repaid", { ...base, outcome: 2 })).toMatch(/on time\.$/);
    expect(sentence("Repaid", { ...base, outcome: 3, newLevel: 1 })).toMatch(
      /on time, promoted to rung 1\.$/,
    );
    expect(sentence("Repaid", { ...base, outcome: 4, lateFee: U / 100n })).toMatch(
      /plus 0.01 USDT fee and 0.01 USDT late fee: late/,
    );
    expect(sentence("Repaid", { ...base, outcome: 5 })).toMatch(/cured a written-off loan/);
    expect(sentence("Repaid", { ...base, payer: B, outcome: 2 })).toMatch(
      /^0x0000…00b0 repaid for 0x0000…00a1/,
    );
  });
  it("WrittenOff, Slashed, Restored, Vouched, Unvouched, Claimed", () => {
    expect(
      sentence("WrittenOff", {
        holder: A,
        principal: 5n * U,
        slashed: 3n * U,
        fromReserve: U,
        socialised: U,
      }),
    ).toBe(
      "0x0000…00a1's loan of 5 USDT was written off: 3 USDT from vouchers, 1 USDT from the reserve, 1 USDT not recovered.",
    );
    expect(sentence("Slashed", { voucher: B, holder: A, amount: 3n * U })).toBe(
      "0x0000…00b0 lost 3 USDT of stake behind 0x0000…00a1.",
    );
    expect(sentence("Restored", { voucher: B, holder: A, amount: 3n * U })).toBe(
      "0x0000…00b0 can claim back 3 USDT after 0x0000…00a1 cured.",
    );
    expect(sentence("Vouched", { voucher: B, holder: A, amount: 2n * U })).toBe(
      "0x0000…00b0 staked 2 USDT behind 0x0000…00a1.",
    );
    expect(sentence("Unvouched", { voucher: B, holder: A, amount: 2n * U })).toBe(
      "0x0000…00b0 took back 2 USDT of stake behind 0x0000…00a1.",
    );
    expect(sentence("Claimed", { who: B, amount: 2n * U })).toBe("0x0000…00b0 claimed 2 USDT.");
  });
  it("owner events", () => {
    expect(sentence("Funded", { amount: 50n * U })).toBe("The owner added 50 USDT to the pool.");
    expect(sentence("Defunded", { amount: U })).toBe(
      "The owner took 1 USDT of unlent capital out of the pool.",
    );
    expect(sentence("ReserveSwept", { amount: U })).toBe(
      "The owner moved 1 USDT from the reserve to lending capital.",
    );
    expect(sentence("CapsSet", { maxOutstanding: 50n * U, dailyNewLineCap: 20 })).toBe(
      "Caps set: at most 50 USDT lent at once, at most 20 new borrowers a day.",
    );
    expect(
      sentence("CapsRaiseQueued", { maxOutstanding: 60n * U, dailyNewLineCap: 30, eta: 1_800_604_800n }),
    ).toBe(
      "A cap raise to 60 USDT and 30 new borrowers a day was queued; it can apply from Fri 22 Jan 2027, 08:00 UTC.",
    );
    expect(sentence("CapsRaiseCancelled", {})).toBe("The queued cap raise was cancelled.");
    expect(sentence("PauseSet", { paused: true })).toBe(
      "New lines, loans and stakes were paused. Repayments still work.",
    );
    expect(sentence("PauseSet", { paused: false })).toBe("New lines, loans and stakes were resumed.");
  });
  it("ignores logs that are not pool events", () => {
    expect(decodePoolLog({ topics: ["0x1234"], data: "0x" })).toBeNull();
  });
});
