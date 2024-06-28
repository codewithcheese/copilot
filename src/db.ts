import sqlite3 from "@vscode/sqlite3";
import * as vscode from "vscode";

export function initializeDatabase(
  db: sqlite3.Database,
  outputChannel: vscode.OutputChannel
) {
  db.run(
    `
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,
    (err) => {
      if (err) {
        outputChannel.appendLine(`Error creating table: ${err.message}`);
      } else {
        outputChannel.appendLine("Messages table created or already exists.");
      }
    }
  );
}

export function addMessageToDatabase(
  db: sqlite3.Database,
  message: string,
  outputChannel: vscode.OutputChannel
) {
  db.run(
    "INSERT INTO messages (content) VALUES (?)",
    [message],
    function (err) {
      if (err) {
        outputChannel.appendLine(`Error inserting message: ${err.message}`);
      } else {
        outputChannel.appendLine(`Message added with ID: ${this.lastID}`);
      }
    }
  );
}
