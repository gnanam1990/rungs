import { calldata, readStanding, rungsPoolAbi } from "@rungs/chain";
import { type LocalChain, anvilBinary, startLocalChain } from "@rungs/chain/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type DB, derivedHash, openDb, setTeam } from "../src/db";
import { loadConfig } from "../src/env";
import { type ChainReader, Indexer } from "../src/indexer";
import { createApp } from "../src/server";

const U = 10n ** 18n;
const WEB = "https://rungs.example";
const EVIL = "<script>alert(1)</script>\u0007";

describe.runIf(anvilBinary() !== null)("keeper against anvil", () => {
  let c: LocalChain;
  let db: DB;
  let ix: Indexer;
  let app: ReturnType<typeof createApp>;
  let dewi: `0x${string}`;
  let arun: `0x${string}`;
  let mira: `0x${string}`;
  let kofi: `0x${string}`;

  const repay = async (who: `0x${string}`) => {
    const [amount] = (await c.client.readContract({
      address: c.pool,
      abi: rungsPoolAbi,
      functionName: "dueOf",
      args: [who],
    })) as readonly [bigint, bigint, number];
    await c.approve(who, amount);
    await c.call(who, "repay");
  };
  const get = async (path: string, headers: Record<string, string> = {}) => {
    const r = await app.request(path, { headers });
    // biome-ignore lint/suspicious/noExplicitAny: response bodies are checked field by field
    const body: any = await r.json();
    return { status: r.status, headers: r.headers, body };
  };

  beforeAll(async () => {
    c = await startLocalChain({ handles: ["dewi", "arun", "mira", EVIL] });
    [dewi, arun, mira, kofi] = c.holders as [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`];
    // scenario
    await c.call(dewi, "openLine");
    await c.call(dewi, "draw", [U]);
    await c.warp(86_400);
    await repay(dewi); // promoted to rung 1
    await c.call(arun, "openLine");
    await c.call(arun, "draw", [U]);
    await c.warp(86_400);
    await repay(arun);
    await c.call(arun, "draw", [2n * U]);
    await c.warp(86_400);
    await repay(arun); // rung 2
    await c.call(mira, "openLine");
    await c.approve(arun, 3n * U);
    await c.call(arun, "vouch", [mira, 3n * U]);
    await c.call(mira, "draw", [4n * U]);
    await c.warp(11 * 86_400);
    await c.call(c.stranger, "writeOff", [mira]);
    await c.call(kofi, "openLine");
    await repay(mira); // cure
    await c.call(arun, "claim");
    await c.call(dewi, "draw", [2n * U]); // left open

    db = openDb(":memory:");
    const config = {
      ...loadConfig({}),
      chainId: 31337,
      pool: c.pool,
      deployBlock: c.deployBlock,
      webOrigin: WEB,
      teamWallets: [dewi.toLowerCase()],
      rateLimitPerMinute: 10_000,
    };
    setTeam(db, config.teamWallets);
    ix = new Indexer(db, c.client as unknown as ChainReader, {
      pool: c.pool,
      deployBlock: c.deployBlock,
      logChunk: 7n, // small chunks on purpose
      reorgRescanBlocks: 5n,
      sleep: async () => {},
    });
    await ix.cycle();
    app = createApp({ db, client: c.client, config });
  }, 120_000);
  afterAll(() => c?.stop());

  it("T-S01 indexer reproduces lines, loans and stakes exactly", async () => {
    for (const h of [dewi, arun, mira, kofi]) {
      const row = db.prepare("SELECT * FROM lines WHERE holder = ?").get(h.toLowerCase()) as Record<
        string,
        number
      >;
      const live = (await c.client.readContract({
        address: c.pool,
        abi: rungsPoolAbi,
        functionName: "lineOf",
        args: [h],
      })) as readonly unknown[];
      expect(row.level, h).toBe(Number(live[2]));
      expect(row.streak, h).toBe(Number(live[3]));
      expect(row.repaid, h).toBe(Number(live[4]));
      expect(row.late, h).toBe(Number(live[5]));
      expect(row.defaults, h).toBe(Number(live[6]));
      expect(row.frozen === 1, h).toBe(live[7]);
      const open = db
        .prepare("SELECT principal FROM loans WHERE holder = ? AND closed_at IS NULL")
        .get(h.toLowerCase()) as { principal: string } | undefined;
      const loan = (await c.client.readContract({
        address: c.pool,
        abi: rungsPoolAbi,
        functionName: "loanOf",
        args: [h],
      })) as readonly bigint[];
      expect(BigInt(open?.principal ?? 0), h).toBe(loan[0]);
    }
    const stake = (await c.client.readContract({
      address: c.pool,
      abi: rungsPoolAbi,
      functionName: "stakeOf",
      args: [arun, mira],
    })) as bigint;
    const row = db.prepare("SELECT amount FROM stakes").all() as { amount: string }[];
    expect(row.map((r) => BigInt(r.amount))).toEqual(stake > 0n ? [stake] : []);
    expect(db.prepare("SELECT COUNT(*) n FROM loans WHERE written_off = 1").get()).toEqual({ n: 1 });
  });

  it("T-S02 replay from zero is byte-identical", async () => {
    const before = derivedHash(db);
    await ix.replay();
    expect(derivedHash(db)).toBe(before);
    const fresh = openDb(":memory:");
    await new Indexer(fresh, c.client as unknown as ChainReader, {
      pool: c.pool,
      deployBlock: c.deployBlock,
      logChunk: 1000n,
      reorgRescanBlocks: 30n,
    }).cycle();
    expect(derivedHash(fresh)).toBe(before);
  });

  it("T-S05 /v1/lines money fields equal live contract reads", async () => {
    const r = await get(`/v1/lines/${dewi}`);
    expect(r.status).toBe(200);
    const live = await readStanding(c.client, c.pool, dewi);
    expect(r.body.standing.level).toBe(live.standing.level);
    expect(BigInt(r.body.limit)).toBe(live.limit);
    expect(BigInt(r.body.loan.dueNow)).toBe(live.due.amount);
    expect(r.body.loan.dueAt).toBe(Number(live.due.dueAt));
    expect(r.body.loan.phase).toBe("current");
    expect(r.body.nextStep).toBe("repay");
    expect(r.body.drawNow).toBe("0"); // a loan is open: nothing more to draw
    expect(r.body.handle).toBe("dewi");
    expect(r.body.history.length).toBe(4);
    expect(r.body.history[0].text).toMatch(/borrowed 2 USDT at rung 1/);
    const a = await get(`/v1/lines/${arun}`);
    expect(a.body.vouchesOut).toEqual([]); // fully slashed, then the cure made it claimable and arun claimed
    expect(a.body.claimable).toBe("0");
    expect(a.body.history.map((h: { name: string }) => h.name)).toContain("Claimed");
  });

  it("T-S06 /actions/draw refuses with a reason", async () => {
    expect((await get(`/v1/lines/${dewi}/actions/draw?amount=1`)).body).toMatchObject({
      ok: false,
      code: "LoanOpen",
    });
    expect((await get(`/v1/lines/${arun}/actions/draw?amount=100`)).body).toMatchObject({
      ok: false,
      code: "AboveLimit",
    });
    expect((await get(`/v1/lines/${c.stranger}/actions/open`)).body).toMatchObject({
      ok: false,
      code: "NotAgentId",
    });
    const snap = await c.snapshot();
    await c.call(c.owner, "setPaused", [true]);
    expect((await get(`/v1/lines/${arun}/actions/draw?amount=1`)).body).toMatchObject({ code: "Paused" });
    await c.call(c.owner, "setPaused", [false]);
    await c.call(c.owner, "setCaps", [2n * U, 20]);
    expect((await get(`/v1/lines/${arun}/actions/draw?amount=1`)).body).toMatchObject({ code: "CapReached" });
    await c.warp(11 * 86_400);
    await c.call(c.stranger, "writeOff", [dewi]);
    expect((await get(`/v1/lines/${dewi}/actions/draw?amount=1`)).body).toMatchObject({ code: "Frozen" });
    expect((await get(`/v1/lines/${dewi}`)).body.nextStep).toBe("cure");
    await c.revert(snap);
    const ok = (await get(`/v1/lines/${arun}/actions/draw?amount=1`)).body;
    expect(ok.ok).toBe(true);
    expect(ok.then).toBe("approve");
    expect(ok.data).toBe(calldata.draw(c.pool, U).data);
    expect(ok.bawPreviewCommand).toContain(`--binanceChainId 31337 --from ${arun}`);
  });

  it("T-S07 /actions/approve amount equals due at the latest block", async () => {
    const r = (await get(`/v1/lines/${dewi}/actions/approve`)).body;
    const live = await readStanding(c.client, c.pool, dewi);
    expect(r.ok).toBe(true);
    expect(r.data).toBe(calldata.approve(c.usdt, c.pool, live.due.amount).data);
  });

  it("T-S08 a handle or any non-address in the path is 400", async () => {
    for (const p of ["/v1/lines/dewi.ai", "/v1/lines/dewi", "/v1/lines/0x1234", `/v1/lines/${dewi}x`]) {
      expect((await get(p)).status, p).toBe(400);
    }
    expect((await get("/v1/lines/dewi.ai/actions/draw")).status).toBe(400);
    expect((await get(`/v1/lines/${arun}/actions/vouch?borrower=mira.ai&amount=1`)).status).toBe(400);
  });

  it("T-S10 stats with and without team wallets equal SQL counts over events", async () => {
    const s = (await get("/v1/stats")).body;
    const n = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
    expect(s.all.linesOpened).toBe(n("SELECT COUNT(*) n FROM events WHERE name='LineOpened'"));
    expect(s.all.linesOpened).toBe(4);
    expect(s.all.loansDrawn).toBe(n("SELECT COUNT(*) n FROM events WHERE name='Drawn'"));
    expect(s.all.writtenOff).toBe(1);
    expect(s.all.cured).toBe(1);
    expect(s.all.promotions).toBe(3);
    expect(s.all.vouches).toBe(1);
    expect(s.all.holders).toBe(4);
    expect(s.all.volumeDrawn).toBe((U + U + 2n * U + 4n * U + 2n * U).toString());
    expect(s.all.byRung[0].writtenOff).toBe(1);
    expect(s.all.byRung[0].lossPrincipal).toBe((4n * U).toString());
    expect(s.excludingTeam.linesOpened).toBe(3);
    expect(s.excludingTeam.holders).toBe(3);
    expect(s.excludingTeam.loansDrawn).toBe(s.all.loansDrawn - 2);
    expect(s.teamWallets).toEqual([dewi.toLowerCase()]);
    expect(BigInt(s.pool.outstanding)).toBe(2n * U);
    expect(typeof s.asOfBlock).toBe("number");
  });

  it("T-S11 CORS only for WEB_ORIGIN and no Set-Cookie anywhere", async () => {
    const routes = [
      "/v1/public/site",
      "/v1/config",
      `/v1/lines/${dewi}`,
      `/v1/lines/${dewi}/actions/approve`,
      "/v1/stats",
      "/v1/events",
      "/llms.txt",
      "/skill.md",
      "/nope",
    ];
    for (const p of routes) {
      const good = await app.request(p, { headers: { origin: WEB } });
      expect(good.headers.get("access-control-allow-origin"), p).toBe(WEB);
      expect(good.headers.get("set-cookie"), p).toBeNull();
      const bad = await app.request(p, { headers: { origin: "https://evil.example" } });
      expect(bad.headers.get("access-control-allow-origin"), p).toBeNull();
    }
    const pre = await app.request("/v1/stats", {
      method: "OPTIONS",
      headers: { origin: "https://evil.example" },
    });
    expect(pre.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("T-S12 a hostile handle is returned as a JSON string, never interpreted", async () => {
    const r = await app.request(`/v1/lines/${kofi}`);
    expect(r.headers.get("content-type")).toMatch(/application\/json/);
    const text = await r.text();
    expect(text).toContain('"handle":"<script>alert(1)</script>?"');
    expect(JSON.parse(text).handle).toBe("<script>alert(1)</script>?");
  });

  it("serves config, events, skill.md and llms.txt with live addresses", async () => {
    const cfg = (await get("/v1/config")).body;
    expect(cfg.pool).toBe(c.pool);
    expect(cfg.constants.LIMITS[6]).toBe((50n * U).toString());
    const ev = (await get("/v1/events?limit=3")).body;
    expect(ev.events).toHaveLength(3);
    const ev2 = (await get(`/v1/events?after=${ev.next}`)).body;
    expect(ev2.events[0].block * 1000 + ev2.events[0].logIndex).toBeGreaterThan(
      ev.events[2].block * 1000 + ev.events[2].logIndex,
    );
    const skill = await (await app.request("/skill.md")).text();
    expect(skill).toContain(c.pool);
    const llms = await (await app.request("/llms.txt")).text();
    expect(llms).toContain(c.pool);
    const site = (await get("/v1/public/site", { "cf-ipcountry": "ID" })).body;
    expect(site).toEqual({ blocked: false, reason: null, mode: "live", notice: null });
  });
});
