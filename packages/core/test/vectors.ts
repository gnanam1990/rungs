import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const path = fileURLToPath(
  new URL("../../../docs/build-pack/08-reference/schemas/ladder-vectors.json", import.meta.url),
);

// biome-ignore lint/suspicious/noExplicitAny: raw JSON, converted field by field in the tests
export const V: any = JSON.parse(readFileSync(path, "utf8"));

export const big = (s: string | number): bigint => BigInt(s);
