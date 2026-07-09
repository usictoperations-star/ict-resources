import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./admin";
import { applicationsTable } from "./applications";
import { teamsTable } from "./teams";

export const vulnerabilitiesTable = pgTable("vulnerabilities", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  severity: text("severity").notNull().default("Medium"),
  status: text("status").notNull().default("Open"),
  applicationId: integer("application_id").references(() => applicationsTable.id, { onDelete: "set null" }),
  cveId: text("cve_id"),
  affectedComponent: text("affected_component"),
  version: text("version"),
  vendor: text("vendor"),
  category: text("category"),
  installationDate: text("installation_date"),
  licenseType: text("license_type"),
  licenseExpiration: text("license_expiration"),
  endOfLifeDate: text("end_of_life_date"),
  discoveredAt: text("discovered_at"),
  resolvedAt: text("resolved_at"),
  assignedTo: text("assigned_to"),
  notes: text("notes"),
  ownerId: integer("owner_id").references(() => usersTable.id),
  teamId: integer("team_id").references(() => teamsTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("vulnerabilities_owner_id_idx").on(table.ownerId),
  index("vulnerabilities_application_id_idx").on(table.applicationId),
  index("vulnerabilities_severity_idx").on(table.severity),
  index("vulnerabilities_status_idx").on(table.status),
  index("vulnerabilities_deleted_at_idx").on(table.deletedAt),
]);

export const insertVulnerabilitySchema = createInsertSchema(vulnerabilitiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVulnerability = z.infer<typeof insertVulnerabilitySchema>;
export type Vulnerability = typeof vulnerabilitiesTable.$inferSelect;
