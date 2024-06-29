import { sql } from "drizzle-orm/sql";
import journal from "./migrations/meta/_journal.json";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

export async function runMigrations(db: BetterSQLite3Database) {
  const haveMigrationsTable = db.get(
    sql.raw(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='migrations';"
    )
  );
  if (!haveMigrationsTable) {
    db.run(
      sql.raw("CREATE TABLE `migrations` (`name` text PRIMARY KEY NOT NULL);")
    );
  }
  for (const entry of journal.entries) {
    await applyMigration(db, entry.idx, entry.tag);
  }
}

async function applyMigration(
  db: BetterSQLite3Database,
  idx: number,
  migration: string
) {
  // check if migration is already applied
  const checkQuery = `SELECT name FROM migrations WHERE name='${migration}'`;
  console.log("checkQuery", checkQuery);
  const hasMigration = await db.get(sql.raw(checkQuery));
  console.log("hasMigration", hasMigration);
  if (!hasMigration) {
    await db.transaction(async (tx) => {
      const migrationSql = (await import(`./migrations/${migration}.sql?raw`))
        .default;
      console.log("Applying migration", migration);
      tx.run(sql.raw(migrationSql));
      tx.run(sql.raw(`INSERT INTO migrations (name) VALUES ('${migration}');`));
    });
  }
}
