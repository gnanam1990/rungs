// Serves the built web app (WEB_DIST) from the keeper, so one service on one domain hosts the site, the API,
// /llms.txt and /skill.md. Page routes get index.html (the app routes in the browser); files are served only from
// inside WEB_DIST; hashed assets are cached for a year, everything else is revalidated.

import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import type { Context } from "hono";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
};

const SAFETY = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
};

async function isFile(p: string) {
  try {
    return (await stat(p)).isFile();
  } catch {
    return false;
  }
}

export function siteHandler(dist: string) {
  const root = resolve(dist);
  const inside = (p: string) => p.startsWith(root + sep);
  return async (c: Context) => {
    let path: string;
    try {
      path = decodeURIComponent(new URL(c.req.url).pathname);
    } catch {
      return c.notFound();
    }
    if (path === "/v1" || path.startsWith("/v1/")) return c.notFound();
    const last = path.split("/").pop() ?? "";
    // a route like /line/0x… has no file extension: answer with the app
    const file = last.includes(".") ? resolve(root, `.${path}`) : resolve(root, "index.html");
    if (!inside(file) || !(await isFile(file))) return c.notFound();
    const immutable = file.startsWith(resolve(root, "assets") + sep);
    return c.body(await readFile(file), 200, {
      ...SAFETY,
      "content-type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream",
      "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
    });
  };
}
