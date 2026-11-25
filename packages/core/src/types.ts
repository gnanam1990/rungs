// Shapes shared by the ladder math. Amounts and times are bigint (wei and Unix seconds).
// Counters are small integers that mirror uint8/uint16 storage in RungsPool and saturate at the type maximum.

export type { Outcome, Phase } from "./constants";

export interface Line {
  /** 0..MAX_LEVEL (uint8) */
  level: number;
  /** qualifying repayments towards the next rung (uint8) */
  streak: number;
  /** on-time repayments (uint16) */
  repaid: number;
  /** late repayments (uint16) */
  late: number;
  /** write-offs (uint16) */
  defaults: number;
  frozen: boolean;
}

export interface Loan {
  principal: bigint;
  fee: bigint;
  drawnAt: bigint;
  dueAt: bigint;
  writtenOff: boolean;
}

export interface RepayResult {
  line: Line;
  outcome: import("./constants").Outcome;
}

export interface SlashSplit {
  perVoucher: bigint[];
  slashed: bigint;
  uncovered: bigint;
}

export interface CureSplit {
  toVouchers: bigint[];
  toReserve: bigint;
  toIdle: bigint;
}

export interface FeeSplit {
  toReserve: bigint;
  toIdle: bigint;
}
