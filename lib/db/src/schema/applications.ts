import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./admin";
import { infrastructureTable } from "./infrastructure";
import { databasesTable } from "./databases";

export const applicationsTable = pgTable("applications", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  shortName: text("short_name"),
  description: text("description"),
  category: text("category").notNull().default("web"),
  classification: text("classification").notNull().default("Web Application"),
  environment: text("environment").notNull().default("Production"),
  status: text("status").notNull().default("Active"),
  priority: text("priority").notNull().default("Medium"),
  criticality: text("criticality").notNull().default("Medium"),
  ministry: text("ministry"),
  department: text("department"),
  businessOwner: text("business_owner"),
  technicalOwner: text("technical_owner"),
  productOwner: text("product_owner"),
  supportContact: text("support_contact"),
  frontend: text("frontend"),
  backend: text("backend"),
  framework: text("framework"),
  language: text("language"),
  database: text("database"),
  serverName: text("server_name"),
  infrastructureId: integer("infrastructure_id").references(() => infrastructureTable.id),
  databaseId: integer("database_id").references(() => databasesTable.id),
  hostingProvider: text("hosting_provider"),
  domain: text("domain"),
  currentVersion: text("current_version"),
  launchDate: text("launch_date"),
  tags: text("tags"),
  ownerId: integer("owner_id").references(() => usersTable.id),
  lastSecurityScanAt: text("last_security_scan_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("applications_owner_id_idx").on(table.ownerId),
  index("applications_infrastructure_id_idx").on(table.infrastructureId),
  index("applications_database_id_idx").on(table.databaseId),
  index("applications_deleted_at_idx").on(table.deletedAt),
  index("applications_status_idx").on(table.status),
]);

export const insertApplicationSchema = createInsertSchema(applicationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertApplication = z.infer<typeof insertApplicationSchema>;
export type Application = typeof applicationsTable.$inferSelect;
