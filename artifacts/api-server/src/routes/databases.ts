import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { databasesTable, auditLogsTable } from "@workspace/db";
import { CreateDatabaseBody, UpdateDatabaseRecordBody } from "@workspace/api-zod";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const results = await db.select().from(databasesTable);
    return res.json(results.map(r => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() })));
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
    return res.status(201).json({ ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Error creating database");
    return res.status(400).json({ error: "Invalid request" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [item] = await db.select().from(databasesTable).where(eq(databasesTable.id, id));
    if (!item) return res.status(404).json({ error: "Not found" });
    return res.json({ ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Error fetching database");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const body = UpdateDatabaseRecordBody.parse(req.body);
    const [item] = await db.update(databasesTable).set({ ...body, updatedAt: new Date() }).where(eq(databasesTable.id, id)).returning();
    if (!item) return res.status(404).json({ error: "Not found" });
    return res.json({ ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Error updating database");
    return res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [item] = await db.delete(databasesTable).where(eq(databasesTable.id, id)).returning();
    if (!item) return res.status(404).json({ error: "Not found" });
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting database");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
