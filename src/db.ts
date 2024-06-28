import "reflect-metadata";
import {
  DataSource,
  Repository,
  Entity,
  PrimaryGeneratedColumn,
  Column,
} from "typeorm";
import * as vscode from "vscode";
import * as sqlite3 from "@vscode/sqlite3";

@Entity()
export class Message {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  content: string;

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  timestamp: Date;
}

export function connectDatabase(extensionUri: vscode.Uri) {
  const dbPath = vscode.Uri.joinPath(extensionUri, "codewithcheese.db").fsPath;

  dataSource = new DataSource({
    type: "sqlite",
    database: dbPath,
    entities: [Message],
    synchronize: true,
    logging: true,
    driver: sqlite3,
  });

  return dataSource;
}

let dataSource: DataSource;
let messageRepository: Repository<Message>;

export async function addMessageToDatabase(
  message: string,
  outputChannel: vscode.OutputChannel
) {
  if (!messageRepository) {
    outputChannel.appendLine("Error: Database not initialized.");
    return;
  }

  try {
    const newMessage = messageRepository.create({ content: message });
    const result = await messageRepository.save(newMessage);
    outputChannel.appendLine(`Message added with ID: ${result.id}`);
  } catch (error) {
    // @ts-ignore
    outputChannel.appendLine(`Error inserting message: ${error.message}`);
  }
}

// Optional: Function to close the database connection
export async function closeDatabase() {
  if (dataSource && dataSource.isInitialized) {
    await dataSource.destroy();
  }
}
