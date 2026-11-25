// SQLite schema. `events` is the source of truth; every other table is derived from it and can be rebuilt.

import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";

export type DB = Database.Database;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS cursor (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_block INTEGER NOT NULL,
  last_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  block INTEGER NOT NULL,
  log_index INTEGER NOT NULL,
  tx TEXT NOT NULL,
  time INTEGER NOT NULL,
  name TEXT NOT NULL,
  holder TEXT,
  actor TEXT,
  json TEXT NOT NULL,
  PRIMARY KEY (block, log_index)
);
CREATE INDEX IF NOT EXISTS events_holder ON events (holder);
CREATE INDEX IF NOT EXISTS events_actor ON events (actor);
CREATE INDEX IF NOT EXISTS events_name ON events (name);
CREATE TABLE IF NOT EXISTS lines (
  holder TEXT PRIMARY KEY,
  handle TEXT,
  level INTEGER NOT NULL,
  streak INTEGER NOT NULL,
  repaid INTEGER NOT NULL,
  late INTEGER NOT NULL,
  defaults INTEGER NOT NULL,
  frozen INTEGER NOT NULL,
  opened_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS loans (
  holder TEXT NOT NULL,
  seq INTEGER NOT NULL,
  principal TEXT NOT NULL,
  fee TEXT NOT NULL,
  level INTEGER NOT NULL,
  drawn_at INTEGER NOT NULL,
  due_at INTEGER NOT NULL,
  closed_at INTEGER,
  outcome INTEGER,
  written_off INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (holder, seq)
);
CREATE TABLE IF NOT EXISTS stakes (
  voucher TEXT NOT NULL,
  borrower TEXT NOT NULL,
  amount TEXT NOT NULL,
  PRIMARY KEY (voucher, borrower)
);
CREATE TABLE IF NOT EXISTS team (address TEXT PRIMARY KEY);
`;

export function openDb(path: string): DB {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}

export function setTeam(db: DB, addresses: string[]): void {
  const tx = db.transaction((xs: string[]) => {
    db.prepare("DELETE FROM team").run();
    const ins = db.prepare("INSERT OR IGNORE INTO team (address) VALUES (?)");
    for (const a of xs) ins.run(a.toLowerCase());
  });
  tx(addresses);
}

/** sha256 over the derived tables in a fixed order: two replays from the same events must give the same hash. */
export function derivedHash(db: DB): string {
  const h = createHash("sha256");
  for (const [table, order] of [
    ["lines", "holder"],
    ["loans", "holder, seq"],
    ["stakes", "voucher, borrower"],
  ] as const) {
    h.update(`#${table}\n`);
    for (const row of db.prepare(`SELECT * FROM ${table} ORDER BY ${order}`).all())
      h.update(`${JSON.stringify(row)}\n`);
  }
  return h.digest("hex");
}
