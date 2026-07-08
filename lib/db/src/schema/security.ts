import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const vulnerabilitiesTable = pgTable("vulnerabilities", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  severity: text("severity").notNull().default("Medium"),
  status: text("status").notNull().default("Open"),
  applicationId: integer("application_id"),
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
  teamId: integer("team_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertVulnerabilitySchema = createInsertSchema(vulnerabilitiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVulnerability = z.infer<typeof insertVulnerabilitySchema>;
export type Vulnerability = typeof vulnerabilitiesTable.$inferSelect;
