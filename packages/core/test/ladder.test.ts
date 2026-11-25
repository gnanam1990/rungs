import fc from "fast-check";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  GRACE,
  LIMITS,
  MAX_LEVEL,
  MIN_FEE,
  MIN_HOLD,
  Outcome,
  Phase,
  TERM,
  UNIT,
  cureSplit,
  due,
  fee,
  feeSplit,
  lateFee,
  limit,
  need,
  onRepay,
  onWriteOff,
  phase,
  slashSplit,
} from "../src/index";
import type { Line, Loan } from "../src/index";
import { V, big } from "./vectors";

const U = UNIT;
const T0 = 1_800_000_000n;
const line = (p: Partial<Line> = {}): Line => ({
  level: 0,
  streak: 0,
  repaid: 0,
  late: 0,
  defaults: 0,
  frozen: false,
  ...p,
});
const loan = (p: Partial<Loan> = {}): Loan => ({
  principal: U,
  fee: MIN_FEE,
  drawnAt: T0,
  dueAt: T0 + TERM,
  writtenOff: false,
  ...p,
});

describe("T-C01 limit", () => {
  it("every level with 0, 10, 50, 80 vouched (capped at +50)", () => {
    for (let lv = 0; lv <= MAX_LEVEL; lv++) {
      const base = LIMITS[lv]!;
      expect(limit(lv, 0n)).toBe(base);
      expect(limit(lv, 10n * U)).toBe(base + 10n * U);
      expect(limit(lv, 50n * U)).toBe(base + 50n * U);
      expect(limit(lv, 80n * U)).toBe(base + 50n * U);
    }
  });
  it("rejects a level outside the ladder", () => {
    expect(() => limit(7, 0n)).toThrow();
    expect(() => limit(-1, 0n)).toThrow();
  });
});

describe("T-C02 fee", () => {
  it("table", () => {
    expect(fee(U)).toBe(U / 100n);
    expect(fee(U / 2n)).toBe(MIN_FEE); // below MIN_DRAW: the caller rejects it, fee is still the minimum
    expect(fee(2n * U)).toBe((2n * U) / 100n);
    expect(fee(50n * U)).toBe(U / 2n);
    expect(fee(100n * U)).toBe(U);
  });
  it("rounds down on odd wei", () => {
    expect(fee(10n * U + 99n)).toBe(U / 10n);
    expect(fee(1_990_000_000_000_000_001n)).toBe(19_900_000_000_000_000n);
  });
  it("late fee has no minimum", () => {
    expect(lateFee(U / 2n)).toBe(U / 200n);
  });
});

describe("T-C03 phase", () => {
  const l = loan();
  it("boundaries", () => {
    expect(phase(loan({ principal: 0n }), T0)).toBe(Phase.NONE);
    expect(phase(l, l.dueAt)).toBe(Phase.CURRENT);
    expect(phase(l, l.dueAt + 1n)).toBe(Phase.LATE);
    expect(phase(l, l.dueAt + GRACE)).toBe(Phase.LATE);
    expect(phase(l, l.dueAt + GRACE + 1n)).toBe(Phase.DEFAULTABLE);
    expect(phase(loan({ writtenOff: true }), l.dueAt + GRACE + 9n)).toBe(Phase.WRITTEN_OFF);
  });
});

describe("T-C04 due", () => {
  it("adds the late fee exactly when now > dueAt", () => {
    const l = loan({ principal: 10n * U, fee: U / 10n });
    expect(due(l, l.dueAt)).toBe(10n * U + U / 10n);
    expect(due(l, l.dueAt + 1n)).toBe(10n * U + U / 10n + U / 10n);
  });
  it("is zero with no loan", () => {
    expect(due(loan({ principal: 0n, fee: 0n }), T0)).toBe(0n);
  });
});

describe("T-C05 onRepay outcomes", () => {
  it("EARLY at 23h59m59s, qualifying at exactly 24h", () => {
    expect(onRepay(line(), loan(), T0 + MIN_HOLD - 1n).outcome).toBe(Outcome.EARLY);
    const r = onRepay(line(), loan(), T0 + MIN_HOLD);
    expect(r.outcome).toBe(Outcome.PROMOTED);
    expect(r.line.level).toBe(1);
  });
  it("SMALL when principal * 2 < rung limit", () => {
    const r = onRepay(line({ level: 2 }), loan({ principal: 2n * U }), T0 + MIN_HOLD);
    expect(r.outcome).toBe(Outcome.SMALL);
    expect(r.line.level).toBe(2);
  });
  it("ON_TIME while on probation", () => {
    expect(onRepay(line({ defaults: 1 }), loan(), T0 + MIN_HOLD).outcome).toBe(Outcome.ON_TIME);
  });
  it("LATE", () => {
    const r = onRepay(line({ level: 2, streak: 1 }), loan({ principal: 5n * U }), T0 + TERM + 1n);
    expect(r.outcome).toBe(Outcome.LATE);
    expect(r.line).toMatchObject({ level: 2, streak: 0, late: 1 });
  });
  it("CURED", () => {
    const r = onRepay(
      line({ frozen: true, defaults: 1 }),
      loan({ writtenOff: true }),
      T0 + TERM + GRACE + 99n,
    );
    expect(r.outcome).toBe(Outcome.CURED);
    expect(r.line).toMatchObject({ level: 0, streak: 0, frozen: false, defaults: 1 });
  });
  it("does not mutate its inputs", () => {
    const l = line();
    const ln = loan();
    onRepay(l, ln, T0 + MIN_HOLD);
    expect(l).toEqual(line());
    expect(ln).toEqual(loan());
  });
});

describe("T-C06 probation", () => {
  const q = T0 + MIN_HOLD;
  it("need()", () => {
    expect([0, 1, 2, 5, 65535].map(need)).toEqual([1, 2, 3, 3, 3]);
  });
  it("one default: two qualifying repayments promote", () => {
    let l = line({ defaults: 1 });
    l = onRepay(l, loan(), q).line;
    expect(l.level).toBe(0);
    const r = onRepay(l, loan(), q);
    expect(r.outcome).toBe(Outcome.PROMOTED);
    expect(r.line.level).toBe(1);
  });
  it("two or five defaults: three are needed", () => {
    for (const d of [2, 5]) {
      let l = line({ defaults: d });
      l = onRepay(l, loan(), q).line;
      l = onRepay(l, loan(), q).line;
      expect(l.level).toBe(0);
      expect(onRepay(l, loan(), q).line.level).toBe(1);
    }
  });
  it("a LATE in between resets the streak", () => {
    let l = line({ defaults: 1 });
    l = onRepay(l, loan(), q).line;
    l = onRepay(l, loan(), T0 + TERM + 1n).line;
    expect(l.streak).toBe(0);
    expect(onRepay(l, loan(), q).outcome).toBe(Outcome.ON_TIME);
  });
});

describe("T-C07 top rung", () => {
  it("level stays 6, streak keeps growing", () => {
    const r = onRepay(line({ level: 6, streak: 2 }), loan({ principal: 50n * U }), T0 + MIN_HOLD);
    expect(r.outcome).toBe(Outcome.ON_TIME);
    expect(r.line).toMatchObject({ level: 6, streak: 3 });
  });
  it("streak saturates at 255", () => {
    const r = onRepay(line({ level: 6, streak: 255 }), loan({ principal: 50n * U }), T0 + MIN_HOLD);
    expect(r.line.streak).toBe(255);
  });
});

describe("T-C08 onWriteOff", () => {
  it("resets level and streak, freezes, counts the default", () => {
    expect(onWriteOff(line({ level: 4, streak: 1, repaid: 7, late: 1 }))).toEqual(
      line({ level: 0, streak: 0, repaid: 7, late: 1, defaults: 1, frozen: true }),
    );
  });
  it("saturates", () => {
    expect(onWriteOff(line({ defaults: 65535 })).defaults).toBe(65535);
    expect(onRepay(line({ late: 65535 }), loan(), T0 + TERM + 1n).line.late).toBe(65535);
    expect(onRepay(line({ repaid: 65535 }), loan(), T0 + MIN_HOLD).line.repaid).toBe(65535);
  });
});

describe("T-C09 shared vectors", () => {
  it("constants", () => {
    expect(V.constants.LIMITS.map(big)).toEqual([...LIMITS]);
    expect(big(V.constants.MIN_FEE)).toBe(MIN_FEE);
    expect(V.constants.OUTCOMES).toEqual(Object.keys(Outcome));
  });
  it("limit", () => {
    for (const v of V.limit) expect(limit(v.level, big(v.vouched))).toBe(big(v.limit));
  });
  it("fee and lateFee", () => {
    for (const v of V.fee) {
      expect(fee(big(v.principal))).toBe(big(v.fee));
      expect(lateFee(big(v.principal))).toBe(big(v.lateFee));
    }
  });
  it("phase", () => {
    for (const v of V.phase) {
      const l = loan({ principal: big(v.principal), dueAt: big(v.dueAt), writtenOff: v.writtenOff });
      expect(phase(l, big(v.now)), v.name).toBe(v.phase);
    }
  });
  it("due", () => {
    for (const v of V.due) {
      const l = loan({ principal: big(v.principal), fee: big(v.fee), dueAt: big(v.dueAt) });
      expect(due(l, big(v.now))).toBe(big(v.due));
    }
  });
  it("onRepay", () => {
    for (const v of V.onRepay) {
      const l = loan({
        principal: big(v.loan.principal),
        drawnAt: big(v.loan.drawnAt),
        dueAt: big(v.loan.dueAt),
        writtenOff: v.loan.writtenOff,
      });
      const r = onRepay(v.line, l, big(v.now));
      expect(r.line, v.name).toEqual(v.expect.line);
      expect(r.outcome, v.name).toBe(v.expect.outcome);
    }
  });
  it("onWriteOff", () => {
    for (const v of V.onWriteOff) expect(onWriteOff(v.line), v.name).toEqual(v.expect);
  });
  it("slashSplit", () => {
    for (const v of V.slashSplit) {
      const r = slashSplit(big(v.principal), v.stakes.map(big));
      expect(r.perVoucher, v.name).toEqual(v.perVoucher.map(big));
      expect(r.slashed, v.name).toBe(big(v.slashed));
      expect(r.uncovered, v.name).toBe(big(v.uncovered));
    }
  });
  it("feeSplit", () => {
    for (const v of V.feeSplit) {
      const r = feeSplit(big(v.feeTotal), big(v.reserve), big(v.reserveTarget));
      expect(r, v.name).toEqual({ toReserve: big(v.toReserve), toIdle: big(v.toIdle) });
    }
  });
});

describe("cureSplit (reverse loss order)", () => {
  it("restores vouchers, then reserve, then idle", () => {
    const r = cureSplit(10n * U, [3n * U, 1n * U], 2n * U);
    expect(r).toEqual({ toVouchers: [3n * U, U], toReserve: 2n * U, toIdle: 4n * U });
  });
  it("round-trips a slash", () => {
    const s = slashSplit(7n * U + 5n, [2n * U, 3n * U + 1n]);
    const r = cureSplit(7n * U + 5n, s.perVoucher, 0n);
    expect(r.toVouchers).toEqual(s.perVoucher);
    expect(r.toIdle).toBe(s.uncovered);
  });
  it("rejects parts that exceed the principal", () => {
    expect(() => cureSplit(U, [U], 1n)).toThrow();
  });
});

describe("T-C10 properties", () => {
  const arbLine = fc.record({
    level: fc.integer({ min: 0, max: 6 }),
    streak: fc.integer({ min: 0, max: 255 }),
    repaid: fc.integer({ min: 0, max: 65535 }),
    late: fc.integer({ min: 0, max: 65535 }),
    defaults: fc.integer({ min: 0, max: 65535 }),
    frozen: fc.boolean(),
  });
  const arbLoan = fc.record({
    principal: fc.bigInt({ min: U, max: 100n * U }),
    drawnAt: fc.constant(T0),
    dueAt: fc.constant(T0 + TERM),
    writtenOff: fc.boolean(),
  });
  const arbNow = fc.bigInt({ min: T0, max: T0 + TERM + GRACE * 4n });

  it("level rises by at most 1; defaults and late never fall", () => {
    fc.assert(
      fc.property(arbLine, arbLoan, arbNow, (l, ln, now) => {
        const r = onRepay(l, { ...ln, fee: fee(ln.principal) }, now);
        expect(r.line.level - l.level).toBeLessThanOrEqual(1);
        expect(r.line.defaults).toBeGreaterThanOrEqual(l.defaults);
        expect(r.line.late).toBeGreaterThanOrEqual(l.late);
        const w = onWriteOff(l);
        expect(w.defaults).toBeGreaterThanOrEqual(l.defaults);
        expect(w.late).toBe(l.late);
      }),
      { numRuns: 2000 },
    );
  });
  it("due >= principal + MIN_FEE", () => {
    fc.assert(
      fc.property(arbLoan, arbNow, (ln, now) => {
        expect(due({ ...ln, fee: fee(ln.principal) }, now) >= ln.principal + MIN_FEE).toBe(true);
      }),
      { numRuns: 2000 },
    );
  });
  it("slashSplit sums exactly and never takes more than a stake", () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 0n, max: 200n * U }),
        fc.array(fc.bigInt({ min: U, max: 50n * U }), { maxLength: 3 }),
        (p, stakes) => {
          const r = slashSplit(p, stakes);
          expect(r.perVoucher.reduce((a, b) => a + b, 0n)).toBe(r.slashed);
          expect(r.slashed + r.uncovered).toBe(p);
          r.perVoucher.forEach((x, i) => expect(x <= stakes[i]!).toBe(true));
        },
      ),
      { numRuns: 2000 },
    );
  });
});

describe("T-C11 no number in money paths", () => {
  it("amount and time parameters are bigint", () => {
    expectTypeOf(fee).parameter(0).toEqualTypeOf<bigint>();
    expectTypeOf(fee).returns.toEqualTypeOf<bigint>();
    expectTypeOf(limit).parameter(1).toEqualTypeOf<bigint>();
    expectTypeOf(phase).parameter(1).toEqualTypeOf<bigint>();
    expectTypeOf(due).returns.toEqualTypeOf<bigint>();
    expectTypeOf<Loan["principal"]>().toEqualTypeOf<bigint>();
    expectTypeOf<Loan["fee"]>().toEqualTypeOf<bigint>();
    expectTypeOf<Loan["drawnAt"]>().toEqualTypeOf<bigint>();
    expectTypeOf<Loan["dueAt"]>().toEqualTypeOf<bigint>();
    expectTypeOf(slashSplit).returns.toEqualTypeOf<{
      perVoucher: bigint[];
      slashed: bigint;
      uncovered: bigint;
    }>();
  });
});

describe("reserveTarget", () => {
  it("is 10% of maxOutstanding", async () => {
    const { reserveTarget } = await import("../src/index");
    expect(reserveTarget(50n * U)).toBe(5n * U);
  });
});

describe("edges", () => {
  it("rungLimit rejects a non-integer level", async () => {
    const { rungLimit } = await import("../src/index");
    expect(rungLimit(3)).toBe(10n * U);
    expect(() => rungLimit(1.5)).toThrow();
  });
  it("slashSplit with zero-value stakes takes nothing", () => {
    expect(slashSplit(5n, [0n])).toEqual({ perVoucher: [0n], slashed: 0n, uncovered: 5n });
  });
});
