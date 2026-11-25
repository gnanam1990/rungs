// /v1/stats. Every count is a SQL count over the events table (T-S10). Sums of wei are added in BigInt because
// SQLite integers stop at 2^63, below 10 USDT in wei.

import type { DB } from "./db";

export interface Counts {
  holders: number;
  linesOpened: number;
  loansDrawn: number;
  repaidOnTime: number;
  repaidLate: number;
  writtenOff: number;
  cured: number;
  promotions: number;
  vouches: number;
  transactions: number;
  volumeDrawn: string;
  byRung: { level: number; holdersNow: number; drawn: number; writtenOff: number; lossPrincipal: string }[];
}

const OWNER_EVENTS =
  "('Funded','Defunded','CapsSet','CapsRaiseQueued','CapsRaiseCancelled','PauseSet','ReserveSwept')";

export function counts(db: DB, excludeTeam: boolean): Counts {
  // rows whose holder or actor is a team wallet are left out of the "excluding team" view
  const notTeam = excludeTeam
    ? " AND COALESCE(holder,'') NOT IN (SELECT address FROM team) AND COALESCE(actor,'') NOT IN (SELECT address FROM team)"
    : "";
  const n = (sql: string, ...p: unknown[]) => (db.prepare(sql).get(...p) as { n: number }).n;
  const outcome = (o: string) =>
    n(
      `SELECT COUNT(*) n FROM events WHERE name = 'Repaid' AND json_extract(json, '$.outcome') IN ${o}${notTeam}`,
    );

  const holders = n(
    `SELECT COUNT(DISTINCT a) n FROM (
       SELECT holder a FROM events WHERE name = 'LineOpened'${notTeam}
       UNION SELECT actor a FROM events WHERE name = 'Vouched'${notTeam}
       UNION SELECT actor a FROM events WHERE actor IN (SELECT holder FROM events WHERE name = 'LineOpened')${notTeam}
     )`,
  );
  const drawnRows = db.prepare(`SELECT json FROM events WHERE name = 'Drawn'${notTeam}`).all() as {
    json: string;
  }[];
  const volumeDrawn = drawnRows.reduce((s, r) => s + BigInt(JSON.parse(r.json).principal), 0n);

  const teamLine = excludeTeam ? " AND holder NOT IN (SELECT address FROM team)" : "";
  const byRung = [0, 1, 2, 3, 4, 5, 6].map((level) => {
    const lost = db
      .prepare(
        `SELECT principal FROM loans WHERE written_off = 1 AND level = ?${excludeTeam ? " AND holder NOT IN (SELECT address FROM team)" : ""}`,
      )
      .all(level) as { principal: string }[];
    return {
      level,
      holdersNow: n(`SELECT COUNT(*) n FROM lines WHERE level = ?${teamLine}`, level),
      drawn: n(
        `SELECT COUNT(*) n FROM events WHERE name = 'Drawn' AND json_extract(json, '$.level') = ?${notTeam}`,
        level,
      ),
      writtenOff: lost.length,
      lossPrincipal: lost.reduce((s, r) => s + BigInt(r.principal), 0n).toString(),
    };
  });

  return {
    holders,
    linesOpened: n(`SELECT COUNT(*) n FROM events WHERE name = 'LineOpened'${notTeam}`),
    loansDrawn: n(`SELECT COUNT(*) n FROM events WHERE name = 'Drawn'${notTeam}`),
    repaidOnTime: outcome("(0,1,2,3)"),
    repaidLate: outcome("(4)"),
    writtenOff: n(`SELECT COUNT(*) n FROM events WHERE name = 'WrittenOff'${notTeam}`),
    cured: outcome("(5)"),
    promotions: outcome("(3)"),
    vouches: n(`SELECT COUNT(*) n FROM events WHERE name = 'Vouched'${notTeam}`),
    transactions: n(`SELECT COUNT(DISTINCT tx) n FROM events WHERE name NOT IN ${OWNER_EVENTS}${notTeam}`),
    volumeDrawn: volumeDrawn.toString(),
    byRung,
  };
}
