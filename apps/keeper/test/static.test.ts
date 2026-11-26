// The keeper can also serve the built site (WEB_DIST), so one service on one domain hosts the site, the API,
// /llms.txt and /skill.md. Same origin: no CORS, no proxy rules at a static host.

import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PublicClient } from "viem";
import { beforeAll, describe, expect, it } from "vitest";
import { openDb } from "../src/db";
import { loadConfig } from "../src/env";
import { createApp } from "../src/server";

const INDEX = '<!doctype html><html><head><title>Rungs</title></head><body><div id="root"></div></body></html>';

function app(webDist: string | null) {
  const config = { ...loadConfig({}), pool: null, webDist };
  return createApp({ db: openDb(":memory:"), client: {} as PublicClient, config });
}

describe("the keeper serves the built site from WEB_DIST", () => {
  let dist: string;
  beforeAll(() => {
    const root = mkdtempSync(join(tmpdir(), "rungs-dist-"));
    dist = join(root, "dist");
    mkdirSync(join(dist, "assets"), { recursive: true });
    writeFileSync(join(dist, "index.html"), INDEX);
    writeFileSync(join(dist, "assets", "index-abc123.js"), "console.log(1)");
    writeFileSync(join(dist, "assets", "index-abc123.css"), "body{}");
    writeFileSync(join(dist, "favicon.svg"), "<svg/>");
    writeFileSync(join(root, "secret.txt"), "outside");
  });

  it("serves index.html at / with no-cache", async () => {
    const r = await app(dist).request("/");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toMatch(/text\/html/);
    expect(r.headers.get("cache-control")).toBe("no-cache");
    expect(await r.text()).toBe(INDEX);
  });

  it("answers every page route with index.html (the app routes in the browser)", async () => {
    for (const p of ["/line/0x70997970C51812dc3A010C7d01b50e0d17dc79C8", "/ladder", "/vouch", "/open", "/agents"]) {
      const r = await app(dist).request(p);
      expect(r.status, p).toBe(200);
      expect(await r.text(), p).toBe(INDEX);
    }
  });

  it("serves hashed assets with the right type and a long cache", async () => {
    const js = await app(dist).request("/assets/index-abc123.js");
    expect(js.status).toBe(200);
    expect(js.headers.get("content-type")).toMatch(/javascript/);
    expect(js.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(await js.text()).toBe("console.log(1)");
    const css = await app(dist).request("/assets/index-abc123.css");
    expect(css.headers.get("content-type")).toMatch(/text\/css/);
    const svg = await app(dist).request("/favicon.svg");
    expect(svg.headers.get("content-type")).toMatch(/image\/svg\+xml/);
  });

  it("a missing asset is a 404, not the page", async () => {
    const r = await app(dist).request("/assets/missing.js");
    expect(r.status).toBe(404);
  });

  it("never serves a file outside WEB_DIST", async () => {
    for (const p of ["/../secret.txt", "/%2e%2e/secret.txt", "/assets/..%2f..%2fsecret.txt", "/..%5csecret.txt"]) {
      const r = await app(dist).request(p);
      expect(await r.text(), p).not.toContain("outside");
    }
  });

  it("leaves the API, llms.txt and skill.md alone", async () => {
    const a = app(dist);
    const site = await a.request("/v1/public/site");
    expect(site.headers.get("content-type")).toMatch(/application\/json/);
    const unknown = await a.request("/v1/nothing-here");
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ error: "Not found." });
    expect((await a.request("/llms.txt")).headers.get("content-type")).toMatch(/text\/plain/);
    expect((await a.request("/skill.md")).headers.get("content-type")).toMatch(/text\/markdown/);
  });

  it("adds basic safety headers to the page", async () => {
    const r = await app(dist).request("/");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("referrer-policy")).toBe("no-referrer");
    expect(r.headers.get("x-frame-options")).toBe("DENY");
  });

  it("without WEB_DIST the keeper is API-only, as before", async () => {
    const r = await app(null).request("/");
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ error: "Not found." });
  });
});

describe("WEB_DIST in the environment", () => {
  it("is read from WEB_DIST and is null when unset", () => {
    expect(loadConfig({ WEB_DIST: "/srv/web" }).webDist).toBe("/srv/web");
    expect(loadConfig({}).webDist).toBeNull();
  });
  it("listens on the host's PORT when KEEPER_PORT is not set (Railway, Fly and Render set PORT)", () => {
    expect(loadConfig({ PORT: "3000" }).port).toBe(3000);
    expect(loadConfig({ PORT: "3000", KEEPER_PORT: "8787" }).port).toBe(8787);
    expect(loadConfig({}).port).toBe(8787);
  });
});
