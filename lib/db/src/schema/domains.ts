import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

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
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDomainSchema = createInsertSchema(domainsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDomain = z.infer<typeof insertDomainSchema>;
export type Domain = typeof domainsTable.$inferSelect;
