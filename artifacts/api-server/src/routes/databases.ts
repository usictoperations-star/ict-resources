import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { databasesTable, auditLogsTable } from "@workspace/db";
import { CreateDatabaseBody, UpdateDatabaseRecordBody } from "@workspace/api-zod";
import { eq, and, isNull, isNotNull, gte } from "drizzle-orm";

const router = Router();

const fmt = (item: typeof databasesTable.$inferSelect) => ({
  ...item,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
  deletedAt: item.deletedAt ? item.deletedAt.toISOString() : null,
});

router.get("/", async (req: Request, res: Response) => {
  try {
    const results = await db.select().from(databasesTable).where(isNull(databasesTable.deletedAt));
    return res.json(results.map(fmt));
  } catch (err) {
    req.log.error({ err }, "Error listing databases");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const body = CreateDatabaseBody.parse(req.body);
    const [item] = await db.insert(databasesTable).values(body).returning();
    await db.insert(auditLogsTable).values({ action: "CREATE", entityType: "Database", entityId: item.id, entityName: item.name, userName: "System" });
    return res.status(201).json(fmt(item));
  } catch (err) {
    req.log.error({ err }, "Error creating database");
    return res.status(400).json({ error: "Invalid request" });
  }
});

router.post("/:id/restore", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [item] = await db.update(databasesTable)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(and(eq(databasesTable.id, id), isNotNull(databasesTable.deletedAt), gte(databasesTable.deletedAt, cutoff)))
      .returning();
    if (!item) return res.status(404).json({ error: "Not found or outside the 30-day restore window" });
    await db.insert(auditLogsTable).values({ action: "RESTORE", entityType: "Database", entityId: item.id, entityName: item.name, userName: "System" });
    return res.json(fmt(item));
  } catch (err) {
    req.log.error({ err }, "Error restoring database");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [item] = await db.select().from(databasesTable).where(and(eq(databasesTable.id, id), isNull(databasesTable.deletedAt)));
    if (!item) return res.status(404).json({ error: "Not found" });
    return res.json(fmt(item));
  } catch (err) {
    req.log.error({ err }, "Error fetching database");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const body = UpdateDatabaseRecordBody.parse(req.body);
    const [item] = await db.update(databasesTable)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(databasesTable.id, id), isNull(databasesTable.deletedAt)))
      .returning();
    if (!item) return res.status(404).json({ error: "Not found" });
    return res.json(fmt(item));
  } catch (err) {
    req.log.error({ err }, "Error updating database");
    return res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [item] = await db.update(databasesTable)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(databasesTable.id, id), isNull(databasesTable.deletedAt)))
      .returning();
    if (!item) return res.status(404).json({ error: "Not found" });
    await db.insert(auditLogsTable).values({ action: "DELETE", entityType: "Database", entityId: item.id, entityName: item.name, userName: "System" });
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting database");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
