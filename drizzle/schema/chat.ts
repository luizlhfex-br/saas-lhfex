import { pgTable, uuid, varchar, text, timestamp, jsonb, pgEnum, index } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const chatRoleEnum = pgEnum("chat_role", ["user", "assistant"]);

export const chatConversations = pgTable("chat_conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  agentId: varchar("agent_id", { length: 50 }).notNull(), // airton, iana, maria, iago
  title: varchar("title", { length: 255 }).default("Nova conversa"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id").notNull().references(() => chatConversations.id, { onDelete: "cascade" }),
  role: chatRoleEnum("role").notNull(),
  content: text("content").notNull(),
  agentId: varchar("agent_id", { length: 50 }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("chat_messages_conversation_idx").on(table.conversationId, table.createdAt),
]);
