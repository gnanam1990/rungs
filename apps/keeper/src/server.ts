// The read API (TDD section 6). GET only, JSON only, no cookies, CORS limited to WEB_ORIGIN, a per-IP rate limit
// kept in memory (IPs are never logged or stored). No route turns a name into a wallet (red line 9).

import {
  ACTIONS,
  type Action,
  type ActionParams,
  type Address,
  type Snapshot,
  isAddress,
  parseUsdt,
  planAction,
  readPool,
  readSnapshot,
  rungsPoolAbi,
} from "@rungs/chain";
import * as C from "@rungs/core";
import { readLlmsTemplate, readSkillTemplate, renderLlms, renderSkill } from "@rungs/skill";
import { Hono } from "hono";
import type { Context } from "hono";
import type { PublicClient } from "viem";
import type { DB } from "./db";
import type { KeeperConfig } from "./env";
import { lineResponse, reviveArgs } from "./lines";
import { decideSite, refuseWhileComingSoon } from "./site";
import { counts } from "./stats";

export interface AppDeps {
  db: DB;
  client: PublicClient;
  config: KeeperConfig;
  /** for tests: override how the client IP is found (the host's proxy header in production) */
  clientIp?: (c: Context) => string;
  now?: () => number;
}

const json = (v: unknown) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x));

export function createApp(deps: AppDeps) {
  const { db, client, config } = deps;
  const now = deps.now ?? Date.now;
  const app = new Hono();

  // ---- CORS: only WEB_ORIGIN; no credentials ----
  app.use("*", async (c, next) => {
    const origin = c.req.header("origin");
    if (c.req.method === "OPTIONS") {
      if (origin === config.webOrigin) {
        c.header("access-control-allow-origin", config.webOrigin);
        c.header("access-control-allow-methods", "GET, OPTIONS");
        c.header("access-control-allow-headers", "content-type");
        c.header("vary", "origin");
      }
      return c.body(null, 204);
    }
    await next();
    if (origin === config.webOrigin) {
      c.header("access-control-allow-origin", config.webOrigin);
      c.header("vary", "origin");
    }
    c.header("x-content-type-options", "nosniff");
    c.header("referrer-policy", "no-referrer");
  });

  // ---- rate limit per IP, in memory only ----
  const hits = new Map<string, { n: number; reset: number }>();
  app.use("*", async (c, next) => {
    const ip =
      deps.clientIp?.(c) ??
      c.req.header("cf-connecting-ip") ??
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      "local";
    const t = now();
    const h = hits.get(ip);
    if (!h || h.reset < t) hits.set(ip, { n: 1, reset: t + 60_000 });
    else if (++h.n > config.rateLimitPerMinute) {
      c.header("retry-after", String(Math.ceil((h.reset - t) / 1000)));
      return c.json({ error: "Too many requests. Try again in a minute." }, 429);
    }
    if (hits.size > 50_000) hits.clear();
    await next();
  });

  // ---- small caches ----
  const cache = new Map<string, { at: number; body: string }>();
  const cached = async (key: string, ttlMs: number, f: () => Promise<unknown>) => {
    const hit = cache.get(key);
    if (hit && now() - hit.at < ttlMs) return hit.body;
    const body = json(await f());
    cache.set(key, { at: now(), body });
    return body;
  };
  const send = (c: Context, body: string, status = 200) =>
    c.body(body, status as 200, { "content-type": "application/json; charset=utf-8" });

  const pool = () => {
    if (!config.pool) throw new NotDeployed();
    return config.pool;
  };

  app.onError((err, c) => {
    if (process.env.KEEPER_DEBUG) console.error(err);
    if (err instanceof NotDeployed) return c.json({ error: "Rungs is not deployed yet." }, 503);
    return c.json(
      { error: "The chain could not be read right now. Nothing is shown rather than a guess." },
      502,
    );
  });

  // ---- routes ----
  app.get("/v1/public/site", async (c) => {
    let paused: boolean | null = null;
    if (config.pool) {
      try {
        paused = JSON.parse(
          await cached("paused", 5_000, async () => (await readPool(client, config.pool!)).paused),
        );
      } catch {
        paused = null;
      }
    }
    const site = decideSite({
      country: c.req.header(config.countryHeader) ?? null,
      blockedCountries: config.blockedCountries,
      unknownCountryPolicy: config.unknownCountryPolicy,
      comingSoon: config.comingSoon || !config.pool,
      paused,
    });
    c.header("cache-control", "no-store");
    return c.json(site);
  });

  app.get("/v1/config", async (c) => {
    const body = await cached("config", 5_000, async () => {
      const p = config.pool ? await readPool(client, config.pool) : null;
      return {
        chainId: config.chainId,
        pool: config.pool,
        registry: p?.registry ?? null,
        usdt: p?.usdt ?? null,
        owner: p?.owner ?? null,
        deployBlock: Number(config.deployBlock),
        explorer: "https://bscscan.com",
        repo: config.repoUrl,
        constants: {
          UNIT: C.UNIT,
          LIMITS: C.LIMITS,
          MAX_LEVEL: C.MAX_LEVEL,
          MIN_DRAW: C.MIN_DRAW,
          TERM: C.TERM,
          GRACE: C.GRACE,
          MIN_HOLD: C.MIN_HOLD,
          FEE_BPS: C.FEE_BPS,
          MIN_FEE: C.MIN_FEE,
          LATE_FEE_BPS: C.LATE_FEE_BPS,
          MAX_VOUCHED: C.MAX_VOUCHED,
          MAX_VOUCHERS: C.MAX_VOUCHERS,
          MAX_VOUCHEES: C.MAX_VOUCHEES,
          MIN_VOUCH_LEVEL: C.MIN_VOUCH_LEVEL,
          MIN_STAKE: C.MIN_STAKE,
          RESERVE_TARGET_BPS: C.RESERVE_TARGET_BPS,
          CAP_RAISE_DELAY: C.CAP_RAISE_DELAY,
        },
        caps: p
          ? {
              maxOutstanding: p.maxOutstanding,
              dailyNewLineCap: p.dailyNewLineCap,
              queuedRaise: p.pendingCaps.eta > 0n ? p.pendingCaps : null,
            }
          : null,
        sourceBlock: p ? Number(p.blockNumber) : null,
        asOfBlock: p ? Number(p.blockNumber) : null,
      };
    });
    return send(c, body);
  });

  const badAddress = (c: Context) =>
    c.json(
      { error: "Enter a wallet address (0x followed by 40 hex characters). Rungs does not look up names." },
      400,
    );

  app.get("/v1/lines/:address", async (c) => {
    const a = c.req.param("address");
    if (!isAddress(a)) return badAddress(c);
    const s = await readSnapshot(client, pool(), a);
    const out = (
      db.prepare("SELECT borrower FROM stakes WHERE voucher = ? ORDER BY borrower").all(a.toLowerCase()) as {
        borrower: string;
      }[]
    ).map((r) => r.borrower as Address);
    const amounts = await Promise.all(
      out.map((b) =>
        client.readContract({
          address: pool(),
          abi: rungsPoolAbi,
          functionName: "stakeOf",
          args: [a, b],
          blockNumber: s.pool.blockNumber,
        }),
      ),
    );
    const vouchesOut = out
      .map((borrower, i) => ({ borrower, amount: amounts[i]! }))
      .filter((v) => v.amount > 0n);
    c.header("cache-control", "no-store");
    return send(c, json(lineResponse(db, s, vouchesOut)));
  });

  app.get("/v1/lines/:address/actions/:action", async (c) => {
    const a = c.req.param("address");
    const action = c.req.param("action") as Action;
    if (!isAddress(a)) return badAddress(c);
    if (!(ACTIONS as readonly string[]).includes(action))
      return c.json({
        ok: false,
        code: "BadInput",
        reason: `Unknown action. Use one of: ${ACTIONS.join(", ")}.`,
      });
    const notYet = refuseWhileComingSoon(config.comingSoon, action);
    if (notYet) return c.json(notYet);
    const borrower = c.req.query("borrower");
    if (borrower !== undefined && !isAddress(borrower)) return badAddress(c);
    const params: ActionParams = { chainId: config.chainId };
    const amount = c.req.query("amount");
    if (amount !== undefined) {
      try {
        params.amount = parseUsdt(amount);
      } catch {
        return c.json({ ok: false, code: "BadInput", reason: "Enter an amount in USDT like 1 or 2.5." });
      }
    }
    if (c.req.query("purpose") === "vouch") params.purpose = "vouch";
    const s: Snapshot = await readSnapshot(client, pool(), a, borrower as Address | undefined);
    c.header("cache-control", "no-store");
    return send(c, json(planAction(action, s, params)));
  });

  app.get("/v1/stats", async (c) => {
    const body = await cached("stats", 5_000, async () => {
      const p = await readPool(client, pool());
      return {
        all: counts(db, false),
        excludingTeam: counts(db, true),
        teamWallets: (
          db.prepare("SELECT address FROM team ORDER BY address").all() as { address: string }[]
        ).map((r) => r.address),
        pool: {
          idle: p.idle,
          reserve: p.reserve,
          outstanding: p.outstanding,
          totalStaked: p.totalStaked,
          socialisedLoss: p.socialisedLoss,
          maxOutstanding: p.maxOutstanding,
          dailyNewLineCap: p.dailyNewLineCap,
          newLinesToday: p.newLinesToday,
          paused: p.paused,
          queuedCapRaise: p.pendingCaps.eta > 0n ? p.pendingCaps : null,
        },
        indexedTo: (
          db.prepare("SELECT last_block FROM cursor WHERE id = 1").get() as { last_block: number } | undefined
        )?.last_block,
        asOfBlock: Number(p.blockNumber),
      };
    });
    return send(c, body);
  });

  app.get("/v1/events", (c) => {
    const after = c.req.query("after") ?? "0:-1";
    const m = /^(\d+):(-?\d+)$/.exec(after);
    if (!m) return c.json({ error: "after must look like <block>:<logIndex>" }, 400);
    const limit = Math.min(500, Math.max(1, Number(c.req.query("limit") ?? 100) || 100));
    const rows = db
      .prepare(
        "SELECT block, log_index, tx, time, name, holder, json FROM events WHERE block > ? OR (block = ? AND log_index > ?) ORDER BY block, log_index LIMIT ?",
      )
      .all(Number(m[1]), Number(m[1]), Number(m[2]), limit) as {
      block: number;
      log_index: number;
      tx: string;
      time: number;
      name: string;
      holder: string | null;
      json: string;
    }[];
    const events = rows.map((r) => ({
      block: r.block,
      logIndex: r.log_index,
      tx: r.tx,
      time: r.time,
      name: r.name,
      holder: r.holder,
      args: JSON.parse(json(reviveArgs(r.json))),
    }));
    const last = rows.at(-1);
    return c.json({ events, next: last ? `${last.block}:${last.log_index}` : null });
  });

  const vars = () => ({
    POOL_ADDRESS: config.pool ?? "",
    USDT_ADDRESS: "0x55d398326f99059fF775485246999027B3197955",
    REGISTRY_ADDRESS: "0x60b9262456de011f7d15a54cdd8c48baaa8b022f",
    KEEPER_URL: config.publicKeeperUrl,
    CHAIN_ID: String(config.chainId),
    REPO_URL: config.repoUrl,
  });
  app.get("/skill.md", (c) =>
    c.body(renderSkill(readSkillTemplate(), vars()), 200, { "content-type": "text/markdown; charset=utf-8" }),
  );
  app.get("/llms.txt", (c) =>
    c.body(renderLlms(readLlmsTemplate(), vars()), 200, { "content-type": "text/plain; charset=utf-8" }),
  );

  app.notFound((c) => c.json({ error: "Not found." }, 404));
  return app;
}

class NotDeployed extends Error {}
