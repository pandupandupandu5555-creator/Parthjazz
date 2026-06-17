import {
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const userMemories = pgTable("user_memories", {
  id: serial("id").primaryKey(),

  key: text("key").notNull(),

  value: text("value").notNull(),

  category: text("category")
    .notNull()
    .default("general"),

  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),
});