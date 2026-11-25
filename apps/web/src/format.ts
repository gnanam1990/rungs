// Display helpers. Amounts are formatted from wei strings with BigInt only; dates in the visitor's timezone.

import { formatUsdt } from "@rungs/chain";

export const usdt = (wei: string | bigint): string => formatUsdt(typeof wei === "bigint" ? wei : BigInt(wei));

const local = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const utc = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

/** "Tue 2 Dec, 14:05" in the visitor's timezone. */
export const when = (unix: number): string => local.format(new Date(unix * 1000));
/** The same moment in UTC, for the tooltip. */
export const whenUtc = (unix: number): string => `${utc.format(new Date(unix * 1000))} UTC`;

export function short(a: string): string {
  // addresses (40 hex) and transaction hashes (64 hex)
  return /^0x[0-9a-fA-F]{40}([0-9a-fA-F]{24})?$/.test(a) ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}
