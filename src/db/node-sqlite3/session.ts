import { Database, Statement } from "@vscode/sqlite3";
import type { BatchItem } from "drizzle-orm/batch";
import { entityKind } from "drizzle-orm/entity";
import type { Logger } from "drizzle-orm/logger";
import { NoopLogger } from "drizzle-orm/logger";
import type {
  RelationalSchemaConfig,
  TablesRelationalConfig,
} from "drizzle-orm/relations";
import type { PreparedQuery } from "drizzle-orm/session";
import { fillPlaceholders, type Query, sql } from "drizzle-orm/sql";
import type { SQLiteAsyncDialect } from "drizzle-orm/sqlite-core/dialect";
import { SQLiteTransaction } from "drizzle-orm/sqlite-core";
import type { SelectedFieldsOrdered } from "drizzle-orm/sqlite-core/query-builders/select.types";
import type {
  PreparedQueryConfig as PreparedQueryConfigBase,
  SQLiteExecuteMethod,
  SQLiteTransactionConfig,
} from "drizzle-orm/sqlite-core/session";
import {
  SQLitePreparedQuery,
  SQLiteSession,
} from "drizzle-orm/sqlite-core/session";
import { mapResultRow } from "./utils";
import type { ResultSet } from "./driver";

export interface SQLite3SessionOptions {
  logger?: Logger;
}

type PreparedQueryConfig = Omit<PreparedQueryConfigBase, "statement" | "run">;

export class SQLite3Session<
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig
> extends SQLiteSession<"async", ResultSet, TFullSchema, TSchema> {
  static readonly [entityKind]: string = "SQLite3Session";

  private logger: Logger;

  constructor(
    private db: Database,
    dialect: SQLiteAsyncDialect,
    private schema: RelationalSchemaConfig<TSchema> | undefined,
    private options: SQLite3SessionOptions
  ) {
    super(dialect);
    this.logger = options.logger ?? new NoopLogger();
  }

  prepareQuery<T extends Omit<PreparedQueryConfig, "run">>(
    query: Query,
    fields: SelectedFieldsOrdered | undefined,
    executeMethod: SQLiteExecuteMethod,
    isResponseInArrayMode: boolean,
    customResultMapper?: (rows: unknown[][]) => unknown
  ): SQLite3PreparedQuery<T> {
    const stmt = this.db.prepare(query.sql);
    return new SQLite3PreparedQuery(
      stmt,
      this.db,
      query,
      this.logger,
      fields,
      executeMethod,
      isResponseInArrayMode,
      customResultMapper
    );
  }

  async batch<T extends BatchItem<"sqlite">[] | readonly BatchItem<"sqlite">[]>(
    queries: T
  ) {
    const preparedQueries: PreparedQuery[] = [];
    const results: unknown[] = [];

    for (const query of queries) {
      // @ts-expect-error
      const preparedQuery = query._prepare();
      preparedQueries.push(preparedQuery);
      const builtQuery = preparedQuery.getQuery();
      const result = await new Promise((resolve, reject) => {
        this.db.all(builtQuery.sql, builtQuery.params as any[], (err, rows) => {
          if (err) reject(err);
          else resolve({ rows });
        });
      });
      results.push(result);
    }

    return results.map((result, i) =>
      preparedQueries[i]!.mapResult(result, true)
    );
  }

  override async transaction<T>(
    transaction: (
      db: SQLite3Transaction<TFullSchema, TSchema>
    ) => T | Promise<T>,
    config?: SQLiteTransactionConfig
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run("BEGIN");
        const tx = new SQLite3Transaction<TFullSchema, TSchema>(
          "async",
          this.dialect,
          this,
          this.schema
        );
        Promise.resolve()
          .then(() => transaction(tx))
          .then((result) => {
            this.db.run("COMMIT");
            resolve(result);
          })
          .catch((err) => {
            this.db.run("ROLLBACK");
            reject(err);
          });
      });
    });
  }
}

export class SQLite3Transaction<
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig
> extends SQLiteTransaction<"async", ResultSet, TFullSchema, TSchema> {
  static readonly [entityKind]: string = "SQLite3Transaction";

  override async transaction<T>(
    transaction: (tx: SQLite3Transaction<TFullSchema, TSchema>) => Promise<T>
  ): Promise<T> {
    const savepointName = `sp${this.nestedIndex}`;
    const tx = new SQLite3Transaction(
      "async",
      this.dialect,
      this.session,
      this.schema,
      this.nestedIndex + 1
    );
    await this.session.run(sql.raw(`savepoint ${savepointName}`));
    try {
      const result = await transaction(tx);
      await this.session.run(sql.raw(`release savepoint ${savepointName}`));
      return result;
    } catch (err) {
      await this.session.run(sql.raw(`rollback to savepoint ${savepointName}`));
      throw err;
    }
  }
}

export class SQLite3PreparedQuery<
  T extends PreparedQueryConfig = PreparedQueryConfig
> extends SQLitePreparedQuery<{
  type: "async";
  run: ResultSet;
  all: T["all"];
  get: T["get"];
  values: T["values"];
  execute: T["execute"];
}> {
  static readonly [entityKind]: string = "SQLite3PreparedQuery";

  constructor(
    private stmt: Statement,
    private db: Database,
    query: Query,
    private logger: Logger,
    /** @internal */ public fields: SelectedFieldsOrdered | undefined,
    executeMethod: SQLiteExecuteMethod,
    private _isResponseInArrayMode: boolean,
    /** @internal */ public customResultMapper?: (
      rows: unknown[][],
      mapColumnValue?: (value: unknown) => unknown
    ) => unknown
  ) {
    super("async", executeMethod, query);
  }

  run(placeholderValues?: Record<string, unknown>): Promise<ResultSet> {
    const params = fillPlaceholders(this.query.params, placeholderValues ?? {});
    this.logger.logQuery(this.query.sql, params);
    return new Promise((resolve, reject) => {
      this.stmt.run(params, function (err) {
        if (err) reject(err);
        else
          resolve({ lastID: this.lastID, changes: this.changes } as ResultSet);
      });
    });
  }

  async all(placeholderValues?: Record<string, unknown>): Promise<T["all"]> {
    const {
      fields,
      logger,
      query,
      db,
      customResultMapper,
      // @ts-expect-error
      joinsNotNullableMap,
    } = this;
    if (!fields && !customResultMapper) {
      const params = fillPlaceholders(query.params, placeholderValues ?? {});
      logger.logQuery(query.sql, params);
      return new Promise((resolve, reject) => {
        db.all(query.sql, params as any[], (err, rows) => {
          if (err) {
            reject(err);
          } else resolve(rows);
        });
      });
    }

    const rows = (await this.values(placeholderValues)) as unknown[][];

    if (customResultMapper) {
      return customResultMapper(rows, normalizeFieldValue) as T["all"];
    }

    return rows.map((row) =>
      mapResultRow(
        fields!,
        Object.values(row).map((v) => normalizeFieldValue(v)),
        joinsNotNullableMap
      )
    );
  }

  async get(placeholderValues?: Record<string, unknown>): Promise<T["get"]> {
    const {
      fields,
      logger,
      query,
      db,
      customResultMapper,
      // @ts-expect-error
      joinsNotNullableMap,
    } = this;
    if (!fields && !customResultMapper) {
      const params = fillPlaceholders(query.params, placeholderValues ?? {});
      logger.logQuery(query.sql, params);
      return new Promise((resolve, reject) => {
        db.get(query.sql, params as any[], (err, row) => {
          if (err) {
            reject(err);
          } else resolve(row);
        });
      });
    }

    const rows = (await this.values(placeholderValues)) as unknown[][];
    return rows.map((row) =>
      mapResultRow(
        fields!,
        Object.values(row).map((v) => normalizeFieldValue(v)),
        joinsNotNullableMap
      )
    );
  }

  values(placeholderValues?: Record<string, unknown>): Promise<T["values"]> {
    const params = fillPlaceholders(this.query.params, placeholderValues ?? {});
    this.logger.logQuery(this.query.sql, params);
    return new Promise((resolve, reject) => {
      this.db.all(this.query.sql, params as any[], (err, rows) => {
        if (err) {
          reject(err);
        } else resolve(rows);
      });
    }) as Promise<T["values"]>;
  }

  /** @internal */
  isResponseInArrayMode(): boolean {
    return this._isResponseInArrayMode;
  }
}

function normalizeFieldValue(value: unknown) {
  if (value instanceof Buffer) {
    return value;
  }
  return value;
}
