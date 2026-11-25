// planAction: given a snapshot read at one block, decide whether an action would succeed and build its call.
// Used by the keeper's /actions route and by the `rungs calldata` CLI so both say exactly the same thing.
// Every amount comes from @rungs/core (the same math as LadderLib.sol). Nothing here signs or sends.

import {
  GRACE,
  MAX_VOUCHED,
  MAX_VOUCHEES,
  MAX_VOUCHERS,
  MIN_DRAW,
  MIN_HOLD,
  MIN_STAKE,
  MIN_VOUCH_LEVEL,
  Outcome,
  due as dueOf,
  fee as feeOf,
  lateFee as lateFeeOf,
  limit as limitOf,
  onRepay,
} from "@rungs/core";
import type { Address } from "./addresses";
import { type Call, bawPreviewCommand, calldata } from "./calldata";
import { formatUsdt, formatUtc, shortAddress } from "./format";
import type { HolderSnapshot, Snapshot } from "./read";

export const ACTIONS = ["open", "draw", "approve", "repay", "vouch", "unvouch", "claim"] as const;
export type Action = (typeof ACTIONS)[number];

export type RefusalCode =
  | "NotAgentId"
  | "NoLine"
  | "LineExists"
  | "Frozen"
  | "LoanOpen"
  | "NoLoan"
  | "BelowMin"
  | "AboveLimit"
  | "PoolShort"
  | "CapReached"
  | "DailyCapReached"
  | "Paused"
  | "VouchRule"
  | "StakeLocked"
  | "NothingToClaim"
  | "BadInput"
  | "NotOpenYet";

export interface ActionOk {
  ok: true;
  to: Address;
  value: "0";
  data: `0x${string}`;
  humanSummary: string;
  bawPreviewCommand: string;
  warnings: string[];
  then: Action | null;
  asOfBlock: number;
}

export interface ActionRefused {
  ok: false;
  code: RefusalCode;
  reason: string;
}

export type ActionResult = ActionOk | ActionRefused;

export interface ActionParams {
  /** wei; draw (default: the full limit), vouch, unvouch, approve for a stake */
  amount?: bigint;
  /** what an approval is for; defaults to a repayment */
  purpose?: "repay" | "vouch";
  chainId?: number;
}

export const RISK_NOTICE =
  "Rungs is an experimental, unaudited lending pilot. You can lose money you stake. Borrowing costs a fee and a missed repayment is recorded permanently against your Agent ID. Nothing here is financial advice or a promise of any return.";

const no = (code: RefusalCode, reason: string): ActionRefused => ({ ok: false, code, reason });

function yes(
  s: Snapshot,
  c: Call,
  humanSummary: string,
  warnings: string[],
  then: Action | null,
  chainId: number,
): ActionOk {
  return {
    ok: true,
    to: c.to,
    value: c.value,
    data: c.data,
    humanSummary,
    bawPreviewCommand: bawPreviewCommand(s.me.address, c, chainId),
    warnings,
    then,
    asOfBlock: Number(s.pool.blockNumber),
  };
}

const terms = (h: HolderSnapshot) => h.loan;
const hasLoan = (h: HolderSnapshot) => h.loan.principal !== 0n;
const usdt = (wei: bigint) => `${formatUsdt(wei)} USDT`;

/** What the holder can draw right now, ignoring pool liquidity. 0 with no line or when frozen. */
export function currentLimit(h: HolderSnapshot): bigint {
  if (!h.line.exists || h.line.frozen) return 0n;
  return limitOf(h.line.level, h.vouchedFor);
}

/**
 * What the pool can lend this holder right now: the limit, cut to the pool's idle money and to the room under the
 * lending cap. 0 when nothing can be drawn (paused, no line, frozen, a loan open, no Agent ID, today's first-borrower
 * cap reached) or when less than the smallest loan fits. The site fills this in; the planner defaults to it.
 */
export function drawableNow(s: Snapshot): bigint {
  const { me, pool } = s;
  if (pool.paused || !me.holdsAgentId || hasLoan(me)) return 0n;
  if (!me.line.everDrawn && pool.newLinesToday >= pool.dailyNewLineCap) return 0n;
  const room = pool.maxOutstanding > pool.outstanding ? pool.maxOutstanding - pool.outstanding : 0n;
  let n = currentLimit(me);
  if (pool.idle < n) n = pool.idle;
  if (room < n) n = room;
  return n < MIN_DRAW ? 0n : n;
}

function outcomeText(h: HolderSnapshot, now: bigint): string {
  const r = onRepay(h.line, terms(h), now);
  switch (r.outcome) {
    case Outcome.CURED:
      return "This cures the written-off loan: the line restarts at rung 0 and the default stays on the record.";
    case Outcome.LATE:
      return "This repayment is late: the rung stays and progress towards the next rung resets.";
    case Outcome.EARLY:
      return "Held under 24 hours, so this repayment closes the loan but does not count towards the next rung.";
    case Outcome.SMALL:
      return "Under half the rung's limit, so this repayment closes the loan but does not count towards the next rung.";
    case Outcome.PROMOTED:
      return `On time: this moves the line up to rung ${r.line.level}.`;
    default:
      return "On time: this counts towards the next rung.";
  }
}

export function planAction(action: Action, s: Snapshot, params: ActionParams): ActionResult {
  const chainId = params.chainId ?? 56;
  const { pool, me } = s;
  const now = pool.timestamp;

  switch (action) {
    case "open": {
      if (pool.paused) return no("Paused", "New lines are paused. Repayments still work.");
      if (!me.holdsAgentId)
        return no(
          "NotAgentId",
          "This address does not hold an Agent ID. Claim one in the Binance App: Wallet → Agent ID.",
        );
      if (me.line.exists) return no("LineExists", "This address already has a line.");
      return yes(
        s,
        calldata.openLine(pool.address),
        "Open your Rungs line. This costs gas only and moves no money.",
        [],
        "draw",
        chainId,
      );
    }

    case "draw": {
      if (pool.paused) return no("Paused", "New loans are paused. Repayments still work.");
      if (!me.line.exists) return no("NoLine", "Open a line first.");
      if (!me.holdsAgentId) return no("NotAgentId", "This address no longer holds an Agent ID.");
      if (me.line.frozen)
        return no(
          "Frozen",
          "This line is frozen after a write-off. Pay what is owed (cure) to restart at rung 0.",
        );
      if (hasLoan(me)) return no("LoanOpen", "There is already an open loan. Repay it first.");
      const lim = currentLimit(me);
      const now_ = drawableNow(s);
      const amount = params.amount ?? (now_ > 0n ? now_ : lim);
      if (amount < MIN_DRAW) return no("BelowMin", `The smallest loan is ${usdt(MIN_DRAW)}.`);
      if (amount > lim) return no("AboveLimit", `Your limit is ${usdt(lim)}.`);
      if (amount > pool.idle) return no("PoolShort", `The pool has ${usdt(pool.idle)} available right now.`);
      if (pool.outstanding + amount > pool.maxOutstanding)
        return no("CapReached", "The pool has reached its total lending cap. Try again after others repay.");
      if (!me.line.everDrawn && pool.newLinesToday >= pool.dailyNewLineCap)
        return no(
          "DailyCapReached",
          "Today's limit on first-time borrowers is reached. Try again after 00:00 UTC.",
        );
      const f = feeOf(amount);
      const dueAt = now + 604_800n;
      const writeOffAt = dueAt + GRACE + 1n;
      const summary = `Borrow ${usdt(amount)}. Repay ${usdt(amount + f)} by ${formatUtc(dueAt)}. Late adds ${usdt(lateFeeOf(amount))}. After ${formatUtc(writeOffAt)} the loan is written off and marked on your name.`;
      return yes(
        s,
        calldata.draw(pool.address, amount),
        summary,
        [
          `Repaying before ${formatUtc(now + MIN_HOLD)} closes the loan but does not count towards the next rung (loans held under 24 hours do not count).`,
          `To repay you need ${usdt(f)} more than you borrow, plus a little BNB for gas.`,
          RISK_NOTICE,
        ],
        "approve",
        chainId,
      );
    }

    case "approve": {
      if (params.purpose === "vouch") {
        const r = checkVouch(s, params.amount);
        if (!r.ok) return r;
        return yes(
          s,
          calldata.approve(pool.usdt, pool.address, r.amount),
          `This approval is for exactly ${usdt(r.amount)}, for this one stake.`,
          [],
          "vouch",
          chainId,
        );
      }
      const target = s.borrower ?? me;
      if (!hasLoan(target)) return no("NoLoan", "There is no loan to repay.");
      const amount = dueOf(terms(target), now);
      const warnings: string[] = [];
      if (!target.loan.writtenOff && now <= target.loan.dueAt && target.loan.dueAt - now < 3_600n) {
        warnings.push(
          `The due time is ${formatUtc(target.loan.dueAt)}. If you repay after it, the amount goes up by ${usdt(lateFeeOf(target.loan.principal))} and you need a new approval.`,
        );
      }
      return yes(
        s,
        calldata.approve(pool.usdt, pool.address, amount),
        `This approval is for exactly ${usdt(amount)}, for this one repayment.`,
        warnings,
        "repay",
        chainId,
      );
    }

    case "repay": {
      const target = s.borrower ?? me;
      const forOther =
        s.borrower !== undefined && s.borrower.address.toLowerCase() !== me.address.toLowerCase();
      if (!hasLoan(target)) return no("NoLoan", "There is no loan to repay.");
      const amount = dueOf(terms(target), now);
      if (me.allowance < amount)
        return no("BadInput", `Approve exactly ${usdt(amount)} first (action "approve"), then repay.`);
      const c = forOther ? calldata.repayFor(pool.address, target.address) : calldata.repay(pool.address);
      const lead = forOther
        ? `Pay ${usdt(amount)} for ${shortAddress(target.address)}. The record goes to them.`
        : `Repay ${usdt(amount)} now.`;
      return yes(s, c, `${lead} ${outcomeText(target, now)}`, [], null, chainId);
    }

    case "vouch": {
      const r = checkVouch(s, params.amount);
      if (!r.ok) return r;
      const b = s.borrower!;
      if (me.allowance < r.amount)
        return no(
          "BadInput",
          `Approve exactly ${usdt(r.amount)} first (action "approve" for a stake), then vouch.`,
        );
      return yes(
        s,
        calldata.vouch(pool.address, b.address, r.amount),
        `Stake ${usdt(r.amount)} behind ${shortAddress(b.address)}. Their limit goes up by the same amount. If their loan is written off, your stake is taken first.`,
        [RISK_NOTICE],
        null,
        chainId,
      );
    }

    case "unvouch": {
      const b = s.borrower;
      if (!b) return no("BadInput", "Say whose stake: pass borrower=<address>.");
      const stake =
        b.vouchesIn.find((v) => v.voucher.toLowerCase() === me.address.toLowerCase())?.amount ?? 0n;
      const amount = params.amount ?? stake;
      if (stake === 0n) return no("BadInput", "You have no stake behind this address.");
      if (amount === 0n || amount > stake) return no("BadInput", `Your stake is ${usdt(stake)}.`);
      if (hasLoan(b))
        return no("StakeLocked", "Stakes are locked while the borrower has an open or written-off loan.");
      return yes(
        s,
        calldata.unvouch(pool.address, b.address, amount),
        `Take back ${usdt(amount)} of your stake behind ${shortAddress(b.address)}.`,
        [],
        null,
        chainId,
      );
    }

    case "claim": {
      if (me.claimable === 0n) return no("NothingToClaim", "Nothing to claim.");
      return yes(
        s,
        calldata.claim(pool.address),
        `Collect ${usdt(me.claimable)} restored to you after a cure.`,
        [],
        null,
        chainId,
      );
    }
  }
}

function checkVouch(s: Snapshot, amount: bigint | undefined): { ok: true; amount: bigint } | ActionRefused {
  const { pool, me } = s;
  const b = s.borrower;
  if (pool.paused) return no("Paused", "New stakes are paused.");
  if (!b) return no("BadInput", "Say who to vouch for: pass borrower=<address>.");
  if (amount === undefined) return no("BadInput", "Say how much to stake: pass amount.");
  if (b.address.toLowerCase() === me.address.toLowerCase())
    return no("VouchRule", "You cannot vouch for yourself.");
  if (!me.holdsAgentId) return no("NotAgentId", "Only Agent ID holders can vouch.");
  if (!me.line.exists) return no("NoLine", "Open a line first.");
  if (me.line.frozen) return no("Frozen", "A frozen line cannot vouch.");
  if (me.line.level < MIN_VOUCH_LEVEL)
    return no("VouchRule", `Vouching needs rung ${MIN_VOUCH_LEVEL} or higher.`);
  if (!b.line.exists) return no("NoLine", "That address has no line yet.");
  if (b.line.frozen)
    return no(
      "VouchRule",
      "That line is frozen after a write-off. A stake there could not help and would stay locked until they pay what they owe.",
    );
  if (amount < MIN_STAKE) return no("BelowMin", `The smallest stake is ${usdt(MIN_STAKE)}.`);
  if (b.vouchedFor + amount > MAX_VOUCHED)
    return no("VouchRule", `At most ${usdt(MAX_VOUCHED)} can be staked behind one person in total.`);
  const already = b.vouchesIn.some((v) => v.voucher.toLowerCase() === me.address.toLowerCase());
  if (!already && b.vouchesIn.length >= MAX_VOUCHERS)
    return no("VouchRule", `That address already has ${MAX_VOUCHERS} vouchers.`);
  if (!already && me.voucheeCount >= MAX_VOUCHEES)
    return no("VouchRule", `You already back ${MAX_VOUCHEES} people.`);
  return { ok: true, amount };
}
