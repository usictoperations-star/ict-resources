import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const pushTokensTable = pgTable("push_tokens", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const domainNotificationStatesTable = pgTable("domain_notification_states", {
  domainId: serial("domain_id").primaryKey(),
  domainName: text("domain_name").notNull(),
  lastUrgency: text("last_urgency").notNull(),
  notifiedAt: timestamp("notified_at").notNull().defaultNow(),
});

export type PushToken = typeof pushTokensTable.$inferSelect;
export type DomainNotificationState = typeof domainNotificationStatesTable.$inferSelect;
