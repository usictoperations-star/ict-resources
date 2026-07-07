import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const releasesTable = pgTable("releases", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id").notNull(),
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
});

export const insertReleaseSchema = createInsertSchema(releasesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRelease = z.infer<typeof insertReleaseSchema>;
export type Release = typeof releasesTable.$inferSelect;
