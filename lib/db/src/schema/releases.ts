import { pgTable, serial, text, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { applicationsTable } from "./applications";

export const releasesTable = pgTable("releases", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id").references(() => applicationsTable.id, { onDelete: "set null" }),
  version: text("version").notNull(),
  environment: text("environment").notNull().default("Production"),
  status: text("status").notNull().default("Deployed"),
  releaseDate: text("release_date"),
  releasedBy: text("released_by"),
  releaseNotes: text("release_notes"),
  rollbackAvailable: boolean("rollback_available").notNull().default(false),
  approved: boolean("approved").notNull().default(false),
  approvedBy: text("approved_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("releases_application_id_idx").on(table.applicationId),
  index("releases_deleted_at_idx").on(table.deletedAt),
]);

export const insertReleaseSchema = createInsertSchema(releasesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRelease = z.infer<typeof insertReleaseSchema>;
export type Release = typeof releasesTable.$inferSelect;
