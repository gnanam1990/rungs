// Decodes RungsPool logs and explains each in one plain sentence. Used by `rungs explain` and the keeper's history.
// Handles in LineOpened are user-chosen text: kept as data (control characters removed), never interpreted.

import { decodeEventLog } from "viem";
import { rungsPoolAbi } from "./abi/RungsPool";
import { formatUsdt, formatUtc, safeHandle, shortAddress } from "./format";

export interface PoolEvent {
  name: string;
  args: Record<string, unknown>;
}

export interface RawLog {
  topics: readonly `0x${string}`[] | `0x${string}`[];
  data: `0x${string}`;
}

/** Returns null for any log that is not a RungsPool event. */
export function decodePoolLog(log: RawLog): PoolEvent | null {
  try {
    const d = decodeEventLog({
      abi: rungsPoolAbi,
      // biome-ignore lint/suspicious/noExplicitAny: viem wants a non-empty tuple type
      topics: log.topics as any,
      data: log.data,
    });
    return { name: d.eventName, args: (d.args ?? {}) as Record<string, unknown> };
  } catch {
    return null;
  }
}

const u = (x: unknown) => `${formatUsdt(x as bigint)} USDT`;
const a = (x: unknown) => shortAddress(String(x));

export function explainEvent(e: PoolEvent): string {
  const g = e.args;
  switch (e.name) {
    case "LineOpened":
      return `${a(g.holder)} opened a line as ${safeHandle(String(g.handle)) ?? "?"}.ai.`;
    case "Drawn":
      return `${a(g.holder)} borrowed ${u(g.principal)} at rung ${g.level} (fee ${u(g.fee)}), due ${formatUtc(g.dueAt as bigint)}.`;
    case "Repaid": {
      const who =
        String(g.payer).toLowerCase() === String(g.holder).toLowerCase()
          ? `${a(g.holder)} repaid`
          : `${a(g.payer)} repaid for ${a(g.holder)}`;
      const late = (g.lateFee as bigint) > 0n ? ` and ${u(g.lateFee)} late fee` : "";
      const what = (() => {
        switch (Number(g.outcome)) {
          case 0:
            return "held under 24 hours, so it does not count towards the next rung";
          case 1:
            return "under half the rung's limit, so it does not count towards the next rung";
          case 2:
            return "on time";
          case 3:
            return `on time, promoted to rung ${g.newLevel}`;
          case 4:
            return "late; the rung stays and progress resets";
          default:
            return "cured a written-off loan; the line restarts at rung 0";
        }
      })();
      return `${who} ${u(g.principal)} plus ${u(g.fee)} fee${late}: ${what}.`;
    }
    case "WrittenOff":
      return `${a(g.holder)}'s loan of ${u(g.principal)} was written off: ${u(g.slashed)} from vouchers, ${u(g.fromReserve)} from the reserve, ${u(g.socialised)} not recovered.`;
    case "Slashed":
      return `${a(g.voucher)} lost ${u(g.amount)} of stake behind ${a(g.holder)}.`;
    case "Restored":
      return `${a(g.voucher)} can claim back ${u(g.amount)} after ${a(g.holder)} cured.`;
    case "Vouched":
      return `${a(g.voucher)} staked ${u(g.amount)} behind ${a(g.holder)}.`;
    case "Unvouched":
      return `${a(g.voucher)} took back ${u(g.amount)} of stake behind ${a(g.holder)}.`;
    case "Claimed":
      return `${a(g.who)} claimed ${u(g.amount)}.`;
    case "Funded":
      return `The owner added ${u(g.amount)} to the pool.`;
    case "Defunded":
      return `The owner took ${u(g.amount)} of unlent capital out of the pool.`;
    case "ReserveSwept":
      return `The owner moved ${u(g.amount)} from the reserve to lending capital.`;
    case "CapsSet":
      return `Caps set: at most ${u(g.maxOutstanding)} lent at once, at most ${g.dailyNewLineCap} new borrowers a day.`;
    case "CapsRaiseQueued":
      return `A cap raise to ${u(g.maxOutstanding)} and ${g.dailyNewLineCap} new borrowers a day was queued; it can apply from ${formatUtc(g.eta as bigint)}.`;
    case "CapsRaiseCancelled":
      return "The queued cap raise was cancelled.";
    case "PauseSet":
      return g.paused
        ? "New lines, loans and stakes were paused. Repayments still work."
        : "New lines, loans and stakes were resumed.";
    default:
      return `${e.name}.`;
  }
}
