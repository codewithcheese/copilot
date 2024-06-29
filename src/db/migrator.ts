import { sql } from "drizzle-orm/sql";
import type { SQLite3Database } from "./node-sqlite3/driver";
import * as path from "node:path";

const journal = require("./migrations/meta/_journal.json");

export async function runMigrations(db: SQLite3Database) {
  const haveMigrationsTable = await db.get(
    sql`SELECT name FROM sqlite_master WHERE type='table' AND name='migrations';`
  );
  if (!haveMigrationsTable) {
    console.log("Creating migrations table");
    await db.run(
      sql`CREATE TABLE \`migrations\` (\`name\` text PRIMARY KEY NOT NULL);`
    );
  } else {
    console.log("Migrations table exists");
  }
  for (const entry of journal.entries) {
    await applyMigration(db, entry.idx, entry.tag);
  }
}

async function applyMigration(
  db: SQLite3Database,
  idx: number,
  migration: string
) {
  const hasMigration = await db.get(
    sql.raw(`SELECT name FROM migrations WHERE name='${migration}'`)
  );
  if (!hasMigration) {
    await db.transaction(async (tx) => {
      const migrationsDir = path.join(__dirname, "db", "migrations");
      const migrationSql = require(path.join(migrationsDir, `${migration}.js`));
      console.log("Applying migration", migration);
      await tx.run(sql.raw(migrationSql));
      await tx.run(
        sql.raw(`INSERT INTO migrations (name) VALUES ('${migration}');`)
      );
    });
  } else {
    console.log(`${migration} exists`);
  }
}
