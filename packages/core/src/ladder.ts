// The ladder, as pure functions. Follows docs/build-pack/02-TDD.md section 4 line by line and must give the
// same answers as contracts/src/LadderLib.sol on ladder-vectors.json. No I/O, no clock, bigint for money and time.

import {
  BPS,
  FEE_BPS,
  GRACE,
  LATE_FEE_BPS,
  LIMITS,
  MAX_LEVEL,
  MAX_VOUCHED,
  MIN_FEE,
  MIN_HOLD,
  Outcome,
  Phase,
  RESERVE_TARGET_BPS,
} from "./constants";
import type { CureSplit, FeeSplit, Line, Loan, RepayResult, SlashSplit } from "./types";

const U8_MAX = 255;
const U16_MAX = 65_535;

const inc8 = (x: number): number => (x >= U8_MAX ? U8_MAX : x + 1);
const inc16 = (x: number): number => (x >= U16_MAX ? U16_MAX : x + 1);
const minB = (a: bigint, b: bigint): bigint => (a < b ? a : b);

/** The rung's own limit, with no vouched part. Throws outside 0..MAX_LEVEL. */
export function rungLimit(level: number): bigint {
  const l = Number.isInteger(level) ? LIMITS[level] : undefined;
  if (l === undefined) throw new RangeError(`level ${level} is outside the ladder`);
  return l;
}

/** limit(level, vouched) = LIMITS[level] + min(vouched, MAX_VOUCHED) */
export function limit(level: number, vouched: bigint): bigint {
  return rungLimit(level) + minB(vouched, MAX_VOUCHED);
}

/** fee(principal) = max(principal * FEE_BPS / 10_000, MIN_FEE) */
export function fee(principal: bigint): bigint {
  const f = (principal * FEE_BPS) / BPS;
  return f > MIN_FEE ? f : MIN_FEE;
}

/** lateFee(principal) = principal * LATE_FEE_BPS / 10_000 (no minimum) */
export function lateFee(principal: bigint): bigint {
  return (principal * LATE_FEE_BPS) / BPS;
}

export function phase(loan: Loan, now: bigint): Phase {
  if (loan.principal === 0n) return Phase.NONE;
  if (loan.writtenOff) return Phase.WRITTEN_OFF;
  if (now <= loan.dueAt) return Phase.CURRENT;
  if (now <= loan.dueAt + GRACE) return Phase.LATE;
  return Phase.DEFAULTABLE;
}

/** due(loan, now) = principal + fee + (now > dueAt ? lateFee(principal) : 0) */
export function due(loan: Loan, now: bigint): bigint {
  if (loan.principal === 0n) return 0n;
  return loan.principal + loan.fee + (now > loan.dueAt ? lateFee(loan.principal) : 0n);
}

/** Qualifying repayments needed to climb one rung: 1 + min(defaults, 2). */
export function need(defaults: number): number {
  return 1 + Math.min(defaults, 2);
}

export function onRepay(line: Line, loan: Loan, now: bigint): RepayResult {
  const l: Line = { ...line };
  if (loan.writtenOff) {
    // cure
    l.frozen = false;
    l.level = 0;
    l.streak = 0;
    return { line: l, outcome: Outcome.CURED };
  }
  if (now > loan.dueAt) {
    l.late = inc16(l.late);
    l.streak = 0;
    return { line: l, outcome: Outcome.LATE };
  }
  l.repaid = inc16(l.repaid);
  if (now - loan.drawnAt < MIN_HOLD) return { line: l, outcome: Outcome.EARLY };
  if (loan.principal * 2n < rungLimit(l.level)) return { line: l, outcome: Outcome.SMALL };
  l.streak = inc8(l.streak);
  if (l.streak >= need(l.defaults) && l.level < MAX_LEVEL) {
    l.level += 1;
    l.streak = 0;
    return { line: l, outcome: Outcome.PROMOTED };
  }
  return { line: l, outcome: Outcome.ON_TIME };
}

export function onWriteOff(line: Line): Line {
  return { ...line, defaults: inc16(line.defaults), level: 0, streak: 0, frozen: true };
}

/**
 * Loss taken from vouchers on a write-off. slashed = min(principal, Σ stakes), split pro rata by stake,
 * rounding down, with the remainder added to the largest stake (the first one on a tie).
 */
export function slashSplit(principal: bigint, stakes: readonly bigint[]): SlashSplit {
  const total = stakes.reduce((a, b) => a + b, 0n);
  const slashed = minB(principal, total);
  const perVoucher = stakes.map((s) => (total === 0n ? 0n : (slashed * s) / total));
  const given = perVoucher.reduce((a, b) => a + b, 0n);
  if (slashed > given) {
    let big = 0;
    stakes.forEach((s, i) => {
      if (s > stakes[big]!) big = i;
    });
    perVoucher[big] = perVoucher[big]! + (slashed - given);
  }
  return { perVoucher, slashed, uncovered: principal - slashed };
}

/**
 * Where the principal of a cure goes, in reverse loss order: each slashed voucher gets back what they lost,
 * then the reserve gets back what it paid, then idle gets the socialised rest.
 * Fees on a cure follow feeSplit as on any repayment.
 */
export function cureSplit(
  principal: bigint,
  slashedPerVoucher: readonly bigint[],
  fromReserve: bigint,
): CureSplit {
  const toVouchers = [...slashedPerVoucher];
  const vouchers = toVouchers.reduce((a, b) => a + b, 0n);
  if (vouchers + fromReserve > principal) throw new RangeError("loss parts exceed the principal");
  return { toVouchers, toReserve: fromReserve, toIdle: principal - vouchers - fromReserve };
}

/** Fees fill the reserve up to its target; the rest goes to idle. */
export function feeSplit(feeTotal: bigint, reserve: bigint, reserveTarget: bigint): FeeSplit {
  const room = reserve >= reserveTarget ? 0n : reserveTarget - reserve;
  const toReserve = minB(feeTotal, room);
  return { toReserve, toIdle: feeTotal - toReserve };
}

/** reserveTarget(maxOutstanding) = maxOutstanding * RESERVE_TARGET_BPS / 10_000 */
export function reserveTarget(maxOutstanding: bigint): bigint {
  return (maxOutstanding * RESERVE_TARGET_BPS) / BPS;
}
