import { pgTable, serial, text, real, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const databasesTable = pgTable("databases", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("PostgreSQL"),
  version: text("version"),
  server: text("server"),
  sizeGb: real("size_gb"),
  owner: text("owner"),
  backupEnabled: boolean("backup_enabled").notNull().default(false),
  encryptionEnabled: boolean("encryption_enabled").notNull().default(false),
  status: text("status").notNull().default("Active"),
  lastBackupAt: text("last_backup_at"),
  lastBackupStatus: text("last_backup_status").notNull().default("Unknown"),
  notes: text("notes"),
  teamId: integer("team_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const insertDatabaseSchema = createInsertSchema(databasesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDatabase = z.infer<typeof insertDatabaseSchema>;
export type DatabaseRecord = typeof databasesTable.$inferSelect;
