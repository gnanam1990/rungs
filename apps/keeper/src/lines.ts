// GET /v1/lines/:address. Money fields come from a live snapshot read from the contract; history from the database.

import { type Snapshot, currentLimit, explainEvent } from "@rungs/chain";
import { GRACE, MIN_HOLD, Phase, due, lateFee, need, phase, rungLimit } from "@rungs/core";
import type { DB } from "./db";

const BIG_FIELDS = new Set([
  "principal",
  "fee",
  "lateFee",
  "amount",
  "slashed",
  "fromReserve",
  "socialised",
  "maxOutstanding",
  "dueAt",
  "eta",
  "vouched",
]);

/** Event args are stored with uints as decimal strings; turn the amount and time fields back into BigInt. */
export function reviveArgs(json: string): Record<string, unknown> {
  return JSON.parse(json, (k, v) => (BIG_FIELDS.has(k) && typeof v === "string" ? BigInt(v) : v));
}

const PHASE_NAMES: Record<number, string> = {
  [Phase.CURRENT]: "current",
  [Phase.LATE]: "late",
  [Phase.DEFAULTABLE]: "defaultable",
  [Phase.WRITTEN_OFF]: "writtenOff",
};

export type NextStep = "claimAgentId" | "open" | "draw" | "repay" | "cure" | "wait" | "none";

/** The one thing the holder should do next. `wait` means the pool cannot lend to them right now. */
export function nextStep(s: Snapshot): NextStep {
  const h = s.me;
  if (!h.line.exists) return h.holdsAgentId ? "open" : "claimAgentId";
  if (h.loan.principal > 0n) return h.loan.writtenOff ? "cure" : "repay";
  if (h.line.frozen) return "none";
  if (!h.holdsAgentId) return "claimAgentId";
  const p = s.pool;
  const lim = currentLimit(h);
  const first = !h.line.everDrawn;
  if (p.paused || p.idle < 10n ** 18n || p.outstanding + 10n ** 18n > p.maxOutstanding || lim === 0n)
    return "wait";
  if (first && p.newLinesToday >= p.dailyNewLineCap) return "wait";
  return "draw";
}

export function lineResponse(db: DB, s: Snapshot, borrowersOf: { borrower: string; amount: bigint }[]) {
  const h = s.me;
  const now = s.pool.timestamp;
  const addr = h.address.toLowerCase();
  const loan =
    h.loan.principal > 0n
      ? {
          principal: h.loan.principal.toString(),
          fee: h.loan.fee.toString(),
          lateFee: lateFee(h.loan.principal).toString(),
          dueNow: due(h.loan, now).toString(),
          drawnAt: Number(h.loan.drawnAt),
          dueAt: Number(h.loan.dueAt),
          writeOffAt: Number(h.loan.dueAt + GRACE + 1n),
          promotesAfter: Number(h.loan.drawnAt + MIN_HOLD),
          phase: PHASE_NAMES[phase(h.loan, now)]!,
        }
      : null;
  const history = (
    db
      .prepare(
        "SELECT block, log_index, tx, time, name, json FROM events WHERE holder = ? OR actor = ? ORDER BY block DESC, log_index DESC LIMIT 100",
      )
      .all(addr, addr) as { block: number; tx: string; time: number; name: string; json: string }[]
  ).map((r) => ({
    name: r.name,
    tx: r.tx,
    block: r.block,
    time: r.time,
    text: explainEvent({ name: r.name, args: reviveArgs(r.json) }),
  }));
  return {
    address: h.address,
    holdsAgentId: h.holdsAgentId,
    handle: h.handle,
    hasLine: h.line.exists,
    standing: h.line.exists
      ? {
          level: h.line.level,
          streak: h.line.streak,
          repaid: h.line.repaid,
          late: h.line.late,
          defaults: h.line.defaults,
          frozen: h.line.frozen,
          need: need(h.line.defaults),
        }
      : null,
    limit: currentLimit(h).toString(),
    rungLimit: (h.line.exists ? rungLimit(h.line.level) : 0n).toString(),
    vouched: h.vouchedFor.toString(),
    loan,
    nextStep: nextStep(s),
    history,
    vouchesIn: h.vouchesIn.map((v) => ({ voucher: v.voucher, amount: v.amount.toString() })),
    vouchesOut: borrowersOf.map((v) => ({ borrower: v.borrower, amount: v.amount.toString() })),
    claimable: h.claimable.toString(),
    asOfBlock: Number(s.pool.blockNumber),
  };
}
