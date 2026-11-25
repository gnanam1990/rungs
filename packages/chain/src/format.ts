// Text helpers for amounts, addresses and dates. Integers only: no floating point touches an amount.

import type { Address } from "./addresses";

const DECIMALS = 18;
const SCALE = 10n ** 18n;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const AMOUNT_RE = /^(\d{1,30})(?:\.(\d{1,18}))?$/;

/** True only for a 20-byte hex address. Names such as "alice.ai" are refused on purpose (red line 9). */
export function isAddress(s: string): s is Address {
  return ADDRESS_RE.test(s);
}

/** Parses "1", "1.5", "0.01" into wei. Throws on anything else (no exponents, no negatives, max 18 decimals). */
export function parseUsdt(s: string): bigint {
  const m = AMOUNT_RE.exec(s.trim());
  if (!m) throw new RangeError(`not an amount: ${JSON.stringify(s)}`);
  const whole = BigInt(m[1]!);
  const frac = (m[2] ?? "").padEnd(DECIMALS, "0");
  return whole * SCALE + BigInt(frac);
}

/**
 * Formats wei as USDT: up to 2 decimals, more only when needed to be exact (UI spec section 6).
 * 1e18 → "1", 1.01e18 → "1.01", 5e15 → "0.005".
 */
export function formatUsdt(wei: bigint): string {
  const neg = wei < 0n;
  const v = neg ? -wei : wei;
  const whole = v / SCALE;
  let frac = (v % SCALE).toString().padStart(DECIMALS, "0").replace(/0+$/, "");
  if (frac.length > 0 && frac.length < 2) frac = frac.padEnd(2, "0");
  return `${neg ? "-" : ""}${whole}${frac ? `.${frac}` : ""}`;
}

/** 0x1234…abcd */
export function shortAddress(a: string): string {
  return isAddress(a) ? `${a.slice(0, 6)}…${a.slice(-4)}`.toLowerCase() : a;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Unix seconds → "Tue 2 Dec 2026, 14:05 UTC". Servers and the CLI do not know the reader's timezone. */
export function formatUtc(unixSeconds: bigint): string {
  const d = new Date(Number(unixSeconds) * 1000);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${hh}:${mm} UTC`;
}

/** Handles are user-chosen text. Keep them as data: strip control characters and cap the length. */
export function safeHandle(h: string | null | undefined): string | null {
  if (!h) return null;
  // biome-ignore lint/suspicious/noControlCharactersInRegex: removing control characters is the point
  return h.replace(/[\u0000-\u001f\u007f-\u009f]/g, "?").slice(0, 64);
}
