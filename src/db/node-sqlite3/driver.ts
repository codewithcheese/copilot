import { Database } from "@vscode/sqlite3";
import type { BatchItem, BatchResponse } from "drizzle-orm/batch";
import { entityKind } from "drizzle-orm/entity";
import { DefaultLogger } from "drizzle-orm/logger";
import {
  createTableRelationsHelpers,
  extractTablesRelationalConfig,
  type ExtractTablesWithRelations,
  type RelationalSchemaConfig,
  type TablesRelationalConfig,
} from "drizzle-orm/relations";
import { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core/db";
import { SQLiteAsyncDialect } from "drizzle-orm/sqlite-core/dialect";
import type { DrizzleConfig } from "drizzle-orm/utils";
import { SQLite3Session } from "./session";

export interface ResultSet {
  lastID?: number;
  changes?: number;
}

export class SQLite3Database<
  TSchema extends Record<string, unknown> = Record<string, never>
> extends BaseSQLiteDatabase<"async", ResultSet, TSchema> {
  static readonly [entityKind]: string = "SQLite3Database";

  /** @internal */
  declare readonly session: SQLite3Session<
    TSchema,
    ExtractTablesWithRelations<TSchema>
  >;

  async batch<U extends BatchItem<"sqlite">, T extends Readonly<[U, ...U[]]>>(
    batch: T
  ): Promise<BatchResponse<T>> {
    return this.session.batch(batch) as Promise<BatchResponse<T>>;
  }
}

export interface SQLite3DrizzleConfig<
  TSchema extends Record<string, unknown> = Record<string, never>
> extends DrizzleConfig<TSchema> {
  connection?: Database;
}

export function drizzle<
  TSchema extends Record<string, unknown> = Record<string, never>
>(config: SQLite3DrizzleConfig<TSchema> = {}): SQLite3Database<TSchema> {
  const dialect = new SQLiteAsyncDialect();
  let logger;
  if (config.logger === true) {
    logger = new DefaultLogger();
  } else if (config.logger !== false) {
    logger = config.logger;
  }

  let schema: RelationalSchemaConfig<TablesRelationalConfig> | undefined;
  if (config.schema) {
    const tablesConfig = extractTablesRelationalConfig(
      config.schema,
      createTableRelationsHelpers
    );
    schema = {
      fullSchema: config.schema,
      schema: tablesConfig.tables,
      tableNamesMap: tablesConfig.tableNamesMap,
    };
  }

  const db = config.connection || new Database(":memory:");
  const session = new SQLite3Session(db, dialect, schema, { logger });
  return new SQLite3Database(
    "async",
    dialect,
    session,
    schema
  ) as SQLite3Database<TSchema>;
}
