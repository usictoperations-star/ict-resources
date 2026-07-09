import { pgTable, serial, text, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./admin";

export const softwareTable = pgTable("software", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("library"),
  installedVersion: text("installed_version"),
  latestVersion: text("latest_version"),
  vendor: text("vendor"),
  license: text("license"),
  supported: boolean("supported").notNull().default(true),
  endOfLife: boolean("end_of_life").notNull().default(false),
  endOfLifeDate: text("end_of_life_date"),
  upgradeAvailable: boolean("upgrade_available").notNull().default(false),
  applicationId: integer("application_id"),
  notes: text("notes"),
  ownerId: integer("owner_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("software_owner_id_idx").on(table.ownerId),
  index("software_application_id_idx").on(table.applicationId),
]);

export const insertSoftwareSchema = createInsertSchema(softwareTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSoftware = z.infer<typeof insertSoftwareSchema>;
export type Software = typeof softwareTable.$inferSelect;
