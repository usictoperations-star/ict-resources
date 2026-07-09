import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./admin";
import { applicationsTable } from "./applications";

export const documentsTable = pgTable("documents", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  type: text("type").notNull().default("PRD"),
  content: text("content"),
  url: text("url"),
  applicationId: integer("application_id").references(() => applicationsTable.id, { onDelete: "set null" }),
  version: text("version"),
  author: text("author"),
  tags: text("tags"),
  ownerId: integer("owner_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("documents_application_id_idx").on(table.applicationId),
  index("documents_owner_id_idx").on(table.ownerId),
  index("documents_deleted_at_idx").on(table.deletedAt),
]);

export const insertDocumentSchema = createInsertSchema(documentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documentsTable.$inferSelect;
