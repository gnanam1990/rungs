// One API mock for every test. It records each call and answers 404 for any /v1 path it does not know, so a
// missing mock fails loudly. Per-test overrides: mockApi(page, { "GET /v1/public/site": {...} }).

import { type Page, expect } from "@playwright/test";

export const KEEPER = "http://localhost:8787";
const U = 10n ** 18n;
const w = (x: bigint) => x.toString();
const NOW = Math.floor(Date.now() / 1000);

export const ADDR = {
  noId: "0x00000000000000000000000000000000000000a0",
  noLine: "0x00000000000000000000000000000000000000a1",
  open: "0x00000000000000000000000000000000000000a2",
  current: "0x00000000000000000000000000000000000000a3",
  late: "0x00000000000000000000000000000000000000a4",
  defaultable: "0x00000000000000000000000000000000000000a5",
  writtenOff: "0x00000000000000000000000000000000000000a6",
  cured: "0x00000000000000000000000000000000000000a7",
  top: "0x00000000000000000000000000000000000000a8",
  evil: "0x00000000000000000000000000000000000000a9",
  down: "0x00000000000000000000000000000000000000aa",
  short: "0x00000000000000000000000000000000000000ab",
} as const;

const standing = (p: Partial<Record<string, unknown>> = {}) => ({
  level: 0,
  streak: 0,
  repaid: 0,
  late: 0,
  defaults: 0,
  frozen: false,
  need: 1,
  ...p,
});

const loan = (principal: bigint, dueIn: number, phase: string, extraLate = false) => ({
  principal: w(principal),
  fee: w(principal / 100n > U / 100n ? principal / 100n : U / 100n),
  lateFee: w(principal / 100n),
  dueNow: w(
    principal +
      (principal / 100n > U / 100n ? principal / 100n : U / 100n) +
      (extraLate ? principal / 100n : 0n),
  ),
  drawnAt: NOW + dueIn - 604_800,
  dueAt: NOW + dueIn,
  writeOffAt: NOW + dueIn + 259_201,
  promotesAfter: NOW + dueIn - 604_800 + 86_400,
  phase,
});

const line = (address: string, p: Record<string, unknown>) => ({
  address,
  holdsAgentId: true,
  handle: "dewi",
  hasLine: true,
  standing: standing(),
  limit: w(U),
  rungLimit: w(U),
  vouched: "0",
  loan: null,
  nextStep: "draw",
  history: [],
  vouchesIn: [],
  vouchesOut: [],
  claimable: "0",
  asOfBlock: 1234,
  // what the pool can lend right now: the full limit unless a test says otherwise; nothing while a loan is open
  drawNow: p.drawNow ?? ((p.nextStep ?? "draw") === "draw" ? (p.limit ?? w(U)) : "0"),
  ...p,
});

export const LINES: Record<string, unknown> = {
  [ADDR.noId]: line(ADDR.noId, {
    holdsAgentId: false,
    handle: null,
    hasLine: false,
    standing: null,
    limit: "0",
    rungLimit: "0",
    nextStep: "claimAgentId",
  }),
  [ADDR.noLine]: line(ADDR.noLine, {
    hasLine: false,
    standing: null,
    limit: "0",
    rungLimit: "0",
    nextStep: "open",
  }),
  [ADDR.open]: line(ADDR.open, {
    standing: standing({ level: 1, repaid: 1 }),
    limit: w(2n * U),
    rungLimit: w(2n * U),
    history: [
      {
        name: "Repaid",
        tx: `0x${"1".repeat(64)}`,
        block: 10,
        time: NOW - 3600,
        text: "0x0000…00a2 repaid 1 USDT plus 0.01 USDT fee: on time, promoted to rung 1.",
      },
    ],
  }),
  [ADDR.current]: line(ADDR.current, {
    standing: standing({ level: 1, repaid: 1 }),
    limit: w(2n * U),
    loan: loan(2n * U, 5 * 86_400, "current"),
    nextStep: "repay",
  }),
  [ADDR.late]: line(ADDR.late, {
    standing: standing({ level: 2, repaid: 2 }),
    limit: w(5n * U),
    loan: loan(5n * U, -3_600, "late", true),
    nextStep: "repay",
  }),
  [ADDR.defaultable]: line(ADDR.defaultable, {
    standing: standing({ level: 2, repaid: 2 }),
    limit: w(5n * U),
    loan: loan(5n * U, -4 * 86_400, "defaultable", true),
    nextStep: "repay",
  }),
  [ADDR.writtenOff]: line(ADDR.writtenOff, {
    standing: standing({ level: 0, defaults: 1, frozen: true, need: 2 }),
    limit: "0",
    loan: loan(5n * U, -20 * 86_400, "writtenOff", true),
    nextStep: "cure",
  }),
  [ADDR.cured]: line(ADDR.cured, {
    standing: standing({ level: 0, defaults: 1, repaid: 2, streak: 1, need: 2 }),
    limit: w(U),
  }),
  [ADDR.top]: line(ADDR.top, {
    standing: standing({ level: 6, repaid: 9, streak: 3 }),
    limit: w(60n * U),
    rungLimit: w(50n * U),
    vouched: w(10n * U),
    vouchesIn: [{ voucher: ADDR.open, amount: w(10n * U) }],
  }),
  [ADDR.short]: line(ADDR.short, {
    standing: standing({ level: 3, repaid: 3 }),
    limit: w(10n * U),
    rungLimit: w(10n * U),
    drawNow: w(4n * U),
  }),
  [ADDR.evil]: line(ADDR.evil, {
    handle: "<img src=x onerror=window.__pwned=1><script>window.__pwned=2</script>",
  }),
};

export const STATS = {
  all: counts(5),
  excludingTeam: counts(4),
  teamWallets: [],
  pool: {
    idle: w(41n * U),
    reserve: w(U / 10n),
    outstanding: w(9n * U),
    totalStaked: w(10n * U),
    socialisedLoss: "0",
    maxOutstanding: w(50n * U),
    dailyNewLineCap: 20,
    newLinesToday: 3,
    paused: false,
    queuedCapRaise: null,
  },
  asOfBlock: 1234,
};

function counts(h: number) {
  return {
    holders: h,
    linesOpened: h,
    loansDrawn: 7,
    repaidOnTime: 5,
    repaidLate: 1,
    writtenOff: 1,
    cured: 0,
    promotions: 3,
    vouches: 1,
    transactions: 20,
    volumeDrawn: w(15n * U),
    byRung: [0, 1, 2, 3, 4, 5, 6].map((level) => ({
      level,
      holdersNow: level < 3 ? 1 : 0,
      drawn: level < 3 ? 2 : 0,
      writtenOff: level === 0 ? 1 : 0,
      lossPrincipal: level === 0 ? w(U) : "0",
    })),
  };
}

export const CONFIG = {
  chainId: 56,
  pool: "0x1111111111111111111111111111111111111111",
  registry: "0x60b9262456de011f7d15a54cdd8c48baaa8b022f",
  usdt: "0x55d398326f99059fF775485246999027B3197955",
  owner: "0x2222222222222222222222222222222222222222",
  deployBlock: 1,
  repo: "https://github.com/gnanam1990/rungs",
  caps: { maxOutstanding: w(50n * U), dailyNewLineCap: 20, queuedRaise: null },
  asOfBlock: 1234,
};

/** What /actions returns: a deterministic, distinctive command per action and amount. */
export function actionReply(address: string, action: string, q: URLSearchParams) {
  if (action === "repay")
    return { ok: false, code: "BadInput", reason: "Approve exactly the amount due first." };
  const tag = `${action}${q.get("amount") ? `-${q.get("amount")}` : ""}`;
  const data = `0x${Buffer.from(tag).toString("hex")}`;
  return {
    ok: true,
    to: CONFIG.pool,
    value: "0",
    data,
    humanSummary: `Summary for ${tag}.`,
    bawPreviewCommand: `baw contract-call preview --binanceChainId 56 --from ${address} --to ${CONFIG.pool} --value 0 --inputData ${data} --json`,
    warnings: [],
    // biome-ignore lint/suspicious/noThenProperty: `then` is a field of the action API's response (the next action)
    then: null,
    asOfBlock: 1234,
  };
}

export interface ApiCall {
  method: string;
  path: string;
}

export async function mockApi(page: Page, overrides: Record<string, unknown> = {}) {
  const calls: ApiCall[] = [];
  await page.route(`${KEEPER}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const key = `${req.method()} ${url.pathname}`;
    calls.push({ method: req.method(), path: url.pathname + url.search });
    const json = (status: number, body: unknown) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (key in overrides) {
      const o = overrides[key];
      if (o && typeof o === "object" && "__status" in o) return json((o as { __status: number }).__status, o);
      return json(200, o);
    }
    if (key === "GET /v1/public/site")
      return json(200, { blocked: false, reason: null, mode: "live", notice: null });
    if (key === "GET /v1/config") return json(200, CONFIG);
    if (key === "GET /v1/stats") return json(200, STATS);
    const act = /^GET \/v1\/lines\/(0x[0-9a-fA-F]{40})\/actions\/(\w+)$/.exec(key);
    if (act) return json(200, actionReply(act[1]!, act[2]!, url.searchParams));
    const ln = /^GET \/v1\/lines\/(0x[0-9a-fA-F]{40})$/.exec(key);
    if (ln) {
      if (ln[1] === ADDR.down) return json(502, { error: "down" });
      const body = LINES[ln[1]!];
      return body ? json(200, body) : json(404, { error: "no mock" });
    }
    return json(404, { error: `no mock for ${key}` });
  });
  return { calls };
}

/** Page wider than the viewport the test set = a layout bug (compare with the viewport, not innerWidth). */
export async function expectNoSidewaysScroll(page: Page) {
  const width = page.viewportSize()!.width;
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
}

export const ROUTES = ["/", `/line/${ADDR.current}`, "/ladder", "/vouch", "/open", "/agents"];
