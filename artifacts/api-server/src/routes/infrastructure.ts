import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { infrastructureTable, auditLogsTable } from "@workspace/db";
import { CreateInfrastructureBody, UpdateInfrastructureBody } from "@workspace/api-zod";
import { eq, and } from "drizzle-orm";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const { type, status } = req.query as Record<string, string>;
    const conditions = [];
    if (type) conditions.push(eq(infrastructureTable.type, type));
    if (status) conditions.push(eq(infrastructureTable.status, status));
    const results = conditions.length
      ? await db.select().from(infrastructureTable).where(and(...conditions))
      : await db.select().from(infrastructureTable);
    return res.json(results.map(r => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() })));
  } catch (err) {
    req.log.error({ err }, "Error listing infrastructure");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const body = CreateInfrastructureBody.parse(req.body);
    const [item] = await db.insert(infrastructureTable).values(body).returning();
    await db.insert(auditLogsTable).values({ action: "CREATE", entityType: "Infrastructure", entityId: item.id, entityName: item.name, userName: "System" });
    return res.status(201).json({ ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Error creating infrastructure");
    return res.status(400).json({ error: "Invalid request" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [item] = await db.select().from(infrastructureTable).where(eq(infrastructureTable.id, id));
    if (!item) return res.status(404).json({ error: "Not found" });
    return res.json({ ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Error fetching infrastructure");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const body = UpdateInfrastructureBody.parse(req.body);
    const [item] = await db.update(infrastructureTable).set({ ...body, updatedAt: new Date() }).where(eq(infrastructureTable.id, id)).returning();
    if (!item) return res.status(404).json({ error: "Not found" });
    return res.json({ ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Error updating infrastructure");
    return res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [item] = await db.delete(infrastructureTable).where(eq(infrastructureTable.id, id)).returning();
    if (!item) return res.status(404).json({ error: "Not found" });
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting infrastructure");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
