import {
  beforeEach,
  afterEach,
  describe,
  expect,
  type Mock,
  test,
  vi,
} from "vitest";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { eq, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import sqlite3 from "@vscode/sqlite3";

// Declare the global vscode interface
declare global {
  var vscode: {
    postMessage: (message: any) => Promise<any>;
  };
}

describe("Drizzle SQLite Proxy in VSCode Webview Test", () => {
  let mockPostMessage: Mock;
  let db: sqlite3.Database;

  const users = sqliteTable("users", {
    id: text("id").primaryKey(),
    name: text("name"),
    balance: integer("balance"),
  });

  beforeEach(() => {
    return new Promise((resolve, reject) => {
      // Reset mocks
      vi.resetAllMocks();

      // Create an in-memory SQLite database
      db = new sqlite3.Database(":memory:", (err) => {
        if (err) {
          console.error(err.message);
        }
        // Create the users table
        db.run(
          `
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          name TEXT,
          balance INTEGER
        )
      `,
          (err) => {
            if (err) {
              console.error(err.message);
              reject(err);
            } else {
              resolve();
            }
          }
        );
      });

      // Create a mock postMessage function that interacts with the SQLite database
      mockPostMessage = vi.fn(async (message: any) => {
        return new Promise((resolve, reject) => {
          if (message.command === "executeQuery") {
            const { sql, params, method } = message;

            if (method === "run") {
              db.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID, changes: this.changes });
              });
            } else if (method === "get") {
              db.get(sql, params, (err, row: any) => {
                if (err) reject(err);
                else resolve({ rows: Object.values(row) });
              });
            } else if (method === "all") {
              db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                resolve(rows);
              });
            }
          } else if (message.command === "executeBatchQueries") {
            db.serialize(() => {
              const results: any[] = [];
              message.queries.forEach((query: any) => {
                const { sql, params, method } = query;
                if (method === "run") {
                  db.run(sql, params, function (err) {
                    if (err) reject(err);
                    results.push({
                      lastID: this.lastID,
                      changes: this.changes,
                    });
                  });
                } else if (method === "get") {
                  db.get(sql, params, (err, row) => {
                    if (err) reject(err);
                    results.push(row);
                  });
                } else if (method === "all") {
                  db.all(sql, params, (err, rows: any[]) => {
                    if (err) reject(err);
                    results.push({
                      rows: rows.map((row) => Object.values(row)),
                    });
                  });
                }
              });
              resolve(results);
            });
          }
        });
      });

      // Mock the global vscode object
      globalThis.vscode = {
        postMessage: mockPostMessage,
      };
    });
  });

  afterEach(() => {
    // Close the database connection after each test
    db.close((err) => {
      if (err) {
        console.error(err.message);
      }
    });
  });

  test("Drizzle proxy executes a query using postMessage", async () => {
    // Create the db instance
    const drizzleDb = drizzle(
      async (sql, params, method) => {
        return vscode.postMessage({
          command: "executeQuery",
          sql,
          params,
          method,
        });
      },
      { schema: { users } }
    );

    // Insert a test user
    await new Promise<void>((resolve, reject) => {
      db.run(
        "INSERT INTO users (id, name, balance) VALUES (?, ?, ?)",
        ["1", "Test User", 100],
        (err) => {
          if (err) reject(err);
          resolve();
        }
      );
    });

    // Execute a query using drizzle
    const result = await drizzleDb.query.users.findFirst({
      where: eq(users.id, "1"),
    });

    // Check if postMessage was called with the correct arguments
    expect(mockPostMessage).toHaveBeenCalledWith({
      command: "executeQuery",
      sql: expect.any(String),
      params: expect.any(Array),
      method: expect.any(String),
    });

    // Check if the result is correct
    expect(result).toEqual({ id: "1", name: "Test User", balance: 100 });
  });

  test("Drizzle proxy handles batch queries", async () => {
    // Create the db instance
    const drizzleDb = drizzle(
      async (sql, params, method) => {
        return vscode.postMessage({
          command: "executeQuery",
          sql,
          params,
          method,
        });
      },
      async (queries: any) => {
        return vscode.postMessage({
          command: "executeBatchQueries",
          queries,
        });
      },
      { schema: { users } }
    );

    // Insert test users
    await new Promise<void>((resolve, reject) => {
      db.run(
        "INSERT INTO users (id, name, balance) VALUES (?, ?, ?), (?, ?, ?)",
        ["1", "User 1", 100, "2", "User 2", 200],
        (err) => {
          if (err) reject(err);
          resolve();
        }
      );
    });

    // Execute batch queries
    const results = await drizzleDb.batch([
      drizzleDb.select().from(users).where(eq(users.id, "1")),
      drizzleDb.select().from(users).where(eq(users.id, "2")),
    ]);

    // Check if postMessage was called with the correct arguments
    expect(mockPostMessage).toHaveBeenCalledWith({
      command: "executeBatchQueries",
      queries: expect.any(Array),
    });

    // Check if the results are correct
    expect(results).toEqual([
      [{ id: "1", name: "User 1", balance: 100 }],
      [{ id: "2", name: "User 2", balance: 200 }],
    ]);
  });

  test("Drizzle proxy executes a transaction", async () => {
    // Create the db instance
    const drizzleDb = drizzle(
      async (sql, params, method) => {
        return vscode.postMessage({
          command: "executeQuery",
          sql,
          params,
          method,
        });
      },
      { schema: { users } }
    );

    // Insert initial data
    await new Promise<void>((resolve, reject) => {
      db.run(
        "INSERT INTO users (id, name, balance) VALUES (?, ?, ?), (?, ?, ?)",
        ["1", "Alice", 100, "2", "Bob", 50],
        (err) => {
          if (err) reject(err);
          resolve();
        }
      );
    });

    // Execute a transaction
    const result = await drizzleDb.transaction(async (tx) => {
      const user = await tx.query.users.findFirst({
        where: eq(users.id, "1"),
      });
      if (user && user.balance && user.balance >= 50) {
        await tx
          .update(users)
          .set({ balance: sql`${users.balance} - 50` })
          .where(eq(users.id, "1"));
        await tx
          .update(users)
          .set({ balance: sql`${users.balance} + 50` })
          .where(eq(users.id, "2"));
        return true;
      }
      return false;
    });

    // Check if postMessage was called for each query in the transaction
    expect(mockPostMessage).toHaveBeenCalledTimes(5); // BEGIN, SELECT, UPDATE, UPDATE, COMMIT

    // Check if the transaction was successful
    expect(result).toBe(true);

    // Verify the balances after the transaction
    const alice = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM users WHERE id = ?", ["1"], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });
    const bob = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM users WHERE id = ?", ["2"], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });

    expect(alice.balance).toBe(50);
    expect(bob.balance).toBe(100);
  });
});
