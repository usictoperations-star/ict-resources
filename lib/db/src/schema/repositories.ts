import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./admin";

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
  applicationId: integer("application_id"),
  status: text("status").notNull().default("Active"),
  notes: text("notes"),
  ownerId: integer("owner_id").references(() => usersTable.id),
  secretsExposed: boolean("secrets_exposed").notNull().default(false),
  lastScannedAt: text("last_scanned_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const insertRepositorySchema = createInsertSchema(repositoriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRepository = z.infer<typeof insertRepositorySchema>;
export type Repository = typeof repositoriesTable.$inferSelect;
