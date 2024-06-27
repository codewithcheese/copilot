import { beforeEach, describe, expect, type Mock, test, vi } from "vitest";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { eq, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Declare the global vscode interface
declare global {
  var vscode: {
    postMessage: (message: any) => Thenable<any>;
  };
}

// Mock the vscode module
vi.mock("vscode", () => ({
  window: {
    createWebviewPanel: vi.fn(),
  },
  ViewColumn: {
    One: 1,
    Two: 2,
    Three: 3,
  },
}));

describe("Drizzle SQLite Proxy in VSCode Webview Test", () => {
  let mockPostMessage: Mock;

  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();

    // Create a mock postMessage function
    mockPostMessage = vi.fn();

    // Mock the global vscode object that would be available in the webview
    globalThis.vscode = {
      postMessage: mockPostMessage,
    };
  });

  test("Drizzle proxy executes a query using postMessage", async () => {
    // Define a sample table
    const users = sqliteTable("users", {
      id: text("id"),
      name: text("name"),
    });

    // Create the db instance
    const db = drizzle(
      async (sql, params, method) => {
        // Simulate sending a message to the extension host
        return vscode.postMessage({
          command: "executeQuery",
          sql,
          params,
          method,
        });
      },
      { schema: { users } }
    );

    // Simulate the extension host's response
    mockPostMessage.mockResolvedValueOnce({
      rows: ["1", "Test User"],
    });

    // Execute a query
    const result = await db.query.users.findFirst({
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
    expect(result).toEqual({ id: "1", name: "Test User" });
  });

  test("Drizzle proxy handles batch queries", async () => {
    // Define a sample table
    const users = sqliteTable("users", {
      id: text("id"),
      name: text("name"),
    });

    // Create the db instance
    const db = drizzle(
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
      }
    );

    // Simulate the extension host's response for batch queries
    mockPostMessage.mockResolvedValueOnce([
      { rows: [["1", "User 1"]] },
      { rows: [["2", "User 2"]] },
    ]);

    // Execute batch queries
    const results = await db.batch([
      db
        .select()
        .from(users)
        .where(sql`id = ${"1"}`),
      db
        .select()
        .from(users)
        .where(sql`id = ${"2"}`),
    ]);

    // Check if postMessage was called with the correct arguments
    expect(mockPostMessage).toHaveBeenCalledWith({
      command: "executeBatchQueries",
      queries: expect.any(Array),
    });

    // Check if the results are correct
    expect(results).toEqual([
      [{ id: "1", name: "User 1" }],
      [{ id: "2", name: "User 2" }],
    ]);
  });

  test("Drizzle proxy executes a transaction", async () => {
    const users = sqliteTable("users", {
      id: text("id").primaryKey(),
      name: text("name"),
      balance: integer("balance"),
    });

    const db = drizzle(
      async (sql, params, method) => {
        return vscode.postMessage({
          command: "executeQuery",
          sql,
          params,
          method,
        });
      },
      {
        schema: { users },
      }
    );

    // Simulate the extension host's responses
    mockPostMessage
      .mockResolvedValueOnce({ rows: [] }) // BEGIN TRANSACTION
      .mockResolvedValueOnce({ rows: ["1", "Alice", 100] }) // SELECT
      .mockResolvedValueOnce({ rows: [] }) // UPDATE
      .mockResolvedValueOnce({ rows: [] }) // UPDATE
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    // Execute a transaction
    const result = await db.transaction(async (tx) => {
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
    expect(mockPostMessage).toHaveBeenCalledTimes(5);
    expect(mockPostMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        command: "executeQuery",
        method: "run",
        params: [],
        sql: "begin",
      })
    );
    expect(mockPostMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        command: "executeQuery",
        method: "get",
        params: ["1", 1],
        sql: expect.stringContaining("select"),
      })
    );
    expect(mockPostMessage).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        command: "executeQuery",
        method: "run",
        params: ["1"],
        sql: expect.stringContaining("update"),
      })
    );
    expect(mockPostMessage).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        command: "executeQuery",
        method: "run",
        params: ["2"],
        sql: expect.stringContaining("update"),
      })
    );
    expect(mockPostMessage).toHaveBeenNthCalledWith(
      5,
      expect.objectContaining({
        command: "executeQuery",
        method: "run",
        params: [],
        sql: "commit",
      })
    );

    // Check if the transaction was successful
    expect(result).toBe(true);
  });
});
