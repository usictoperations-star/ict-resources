import { pgTable, serial, text, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./admin";
import { applicationsTable } from "./applications";

export const repositoriesTable = pgTable("repositories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url"),
  defaultBranch: text("default_branch"),
  visibility: text("visibility").notNull().default("private"),
  language: text("language"),
  openPullRequests: integer("open_pull_requests").notNull().default(0),
  openIssues: integer("open_issues").notNull().default(0),
  lastCommitAt: text("last_commit_at"),
  applicationId: integer("application_id").references(() => applicationsTable.id, { onDelete: "set null" }),
  status: text("status").notNull().default("Active"),
  notes: text("notes"),
  ownerId: integer("owner_id").references(() => usersTable.id),
  secretsExposed: boolean("secrets_exposed").notNull().default(false),
  lastScannedAt: text("last_scanned_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("repositories_owner_id_idx").on(table.ownerId),
  index("repositories_application_id_idx").on(table.applicationId),
  index("repositories_deleted_at_idx").on(table.deletedAt),
]);

export const insertRepositorySchema = createInsertSchema(repositoriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRepository = z.infer<typeof insertRepositorySchema>;
export type Repository = typeof repositoriesTable.$inferSelect;
