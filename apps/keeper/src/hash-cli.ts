// Prints the sha256 of the derived tables (for the replay check in PROVEN.md).
import { derivedHash, openDb } from "./db";
import { loadConfig } from "./env";

console.log(derivedHash(openDb(loadConfig().dbPath)));
