import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./admin";
import { teamsTable } from "./teams";

export const infrastructureTable = pgTable("infrastructure", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("Server"),
  provider: text("provider"),
  status: text("status").notNull().default("Active"),
  ipAddress: text("ip_address"),
  location: text("location"),
  cpuCores: integer("cpu_cores"),
  ramGb: integer("ram_gb"),
  diskGb: integer("disk_gb"),
  os: text("os"),
  notes: text("notes"),
  ownerId: integer("owner_id").references(() => usersTable.id),
  teamId: integer("team_id").references(() => teamsTable.id, { onDelete: "set null" }),
  patchStatus: text("patch_status").notNull().default("Up to Date"),
  lastPatchedAt: text("last_patched_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("infrastructure_owner_id_idx").on(table.ownerId),
  index("infrastructure_deleted_at_idx").on(table.deletedAt),
  index("infrastructure_status_idx").on(table.status),
]);

export const insertInfrastructureSchema = createInsertSchema(infrastructureTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInfrastructure = z.infer<typeof insertInfrastructureSchema>;
export type Infrastructure = typeof infrastructureTable.$inferSelect;
