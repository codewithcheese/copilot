import { Database } from "@vscode/sqlite3";
import { drizzle } from "./node-sqlite3/driver";

export { runMigrations } from "./migrator.js";
export * as schema from "./schema.js";

export function initDb(uri: string) {
  console.log("Initializing database", uri);
  const sqlite = new Database(uri);
  return drizzle({ connection: sqlite });
}
