// The signature element: seven bars growing with the limit. The holder's rung is filled, rungs below are outlined in
// yellow, rungs above in grey. Every state also has text, not only colour.

import { LIMITS } from "@rungs/core";
import { usdt } from "../format";

const MAX = Number(LIMITS[LIMITS.length - 1]! / 10n ** 18n);

export function Ladder({ level, small = false }: { level: number | null; small?: boolean }) {
  const rungs = LIMITS.map((l, i) => ({
    i,
    limit: l,
    w: `${Math.max(18, (Number(l / 10n ** 18n) / MAX) * 100)}%`,
  })).reverse();
  return (
    <ol
      className={`ladder${small ? " ladder-sm" : ""}`}
      aria-label={level === null ? "The ladder" : `The ladder: rung ${level} of 6`}
    >
      {rungs.map((r) => {
        const state = level === null ? "above" : r.i === level ? "current" : r.i < level ? "below" : "above";
        return (
          <li key={r.i} className={`rung ${state}`}>
            <span className="bar" style={{ ["--w" as string]: r.w }} />
            {!small && (
              <span className="lbl">
                {r.i === level ? "▶ " : ""}rung {r.i} · {usdt(r.limit)} USDT
                <span className="sr-only">{state === "current" ? " (you are here)" : ""}</span>
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function Wordmark() {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <g stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M9 4v24M23 4v24M9 10h14M9 16h14M9 22h14" />
      </g>
    </svg>
  );
}
