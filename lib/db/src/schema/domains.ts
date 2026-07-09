import { pgTable, serial, text, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./admin";
import { teamsTable } from "./teams";

export const domainsTable = pgTable("domains", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  registrar: text("registrar"),
  registrationExpiry: text("registration_expiry"),
  sslProvider: text("ssl_provider"),
  sslExpiry: text("ssl_expiry"),
  sslStatus: text("ssl_status").notNull().default("Valid"),
  dnsProvider: text("dns_provider"),
  cloudflarEnabled: boolean("cloudflare_enabled").notNull().default(false),
  status: text("status").notNull().default("Active"),
  applicationId: integer("application_id"),
  ownerId: integer("owner_id").references(() => usersTable.id),
  teamId: integer("team_id").references(() => teamsTable.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("domains_owner_id_idx").on(table.ownerId),
  index("domains_application_id_idx").on(table.applicationId),
  index("domains_deleted_at_idx").on(table.deletedAt),
  index("domains_ssl_expiry_idx").on(table.sslExpiry),
  index("domains_registration_expiry_idx").on(table.registrationExpiry),
]);

export const insertDomainSchema = createInsertSchema(domainsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDomain = z.infer<typeof insertDomainSchema>;
export type Domain = typeof domainsTable.$inferSelect;
