import {
  index,
  int,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm/sql";
import { type InferSelectModel, relations } from "drizzle-orm";

/**
 * Models
 */

export const modelTable = sqliteTable(
  "models",
  {
    id: text("id").notNull().primaryKey(),
    keyId: text("keyId")
      .notNull()
      .references(() => keyTable.id),
    name: text("name").notNull(),
    visible: int("visible").notNull(),
    createdAt: text("createdAt").default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    keyIdIndex: index("keyIdIndex").on(table.keyId),
  })
);

export const keyTable = sqliteTable("keys", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  serviceId: text("serviceId")
    .notNull()
    .references(() => serviceTable.id),
  apiKey: text("apiKey").notNull(),
  createdAt: text("createdAt").default(sql`(CURRENT_TIMESTAMP)`),
});

export const serviceTable = sqliteTable("services", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  apiType: text("apiType").notNull(),
  baseURL: text("baseURL").notNull(),
  createdAt: text("createdAt").default(sql`(CURRENT_TIMESTAMP)`),
});

/**
 * Chat
 */

export const chatTable = sqliteTable("chats", {
  id: text("id").primaryKey(),
  createdAt: text("createdAt").default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text("updatedAt").default(sql`(CURRENT_TIMESTAMP)`),
});

type MessageContent =
  | { type: "text"; text: string }
  | {
      type: "artifact";
      artifact: {
        identifier: string;
        type: string;
        title: string;
        text: string;
      };
    };

export const messageTable = sqliteTable(
  "messages",
  {
    id: text("id").notNull(),
    chatId: text("chatId")
      .notNull()
      .references(() => chatTable.id),
    sender: text("sender"),
    recipients: text("recipients", { mode: "json" })
      .$type<string[]>()
      .default([])
      .notNull(),
    role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
    content: text("content", { mode: "json" }).$type<MessageContent>(),
    data: text("data", { mode: "json" }),
    createdAt: text("createdAt").default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text("updatedAt").default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.id, t.chatId] }),
  })
);

/**
 * Types
 */

export type Chat = InferSelectModel<typeof chatTable>;
export type Message = InferSelectModel<typeof messageTable>;

export type Model = InferSelectModel<typeof modelTable>;
export type Key = InferSelectModel<typeof keyTable>;
export type Service = InferSelectModel<typeof serviceTable>;

export const chatRelations = relations(chatTable, ({ many }) => ({
  messages: many(messageTable),
}));

export const messageRelations = relations(messageTable, ({ one }) => ({
  chat: one(chatTable, {
    fields: [messageTable.chatId],
    references: [chatTable.id],
  }),
}));

export const modelRelations = relations(modelTable, ({ one, many }) => ({
  keys: one(keyTable, {
    fields: [modelTable.keyId],
    references: [keyTable.id],
  }),
}));

export const keyRelations = relations(keyTable, ({ one, many }) => ({
  model: many(modelTable),
  one: one(serviceTable, {
    fields: [keyTable.serviceId],
    references: [serviceTable.id],
  }),
}));

export const serviceRelations = relations(serviceTable, ({ one, many }) => ({
  keys: many(keyTable),
}));
