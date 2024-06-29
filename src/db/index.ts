import { drizzle } from "drizzle-orm/better-sqlite3";
// better_sqlite3_1.default is not a constructor when using `import`
const Database = require("better-sqlite3");

export { runMigrations } from "./migrator.js";
export * as schema from "./schema.js";

export function initDb(uri: string) {
  console.log("Initializing database", uri);
  const sqlite = new Database(uri);
  return drizzle(sqlite);
}
