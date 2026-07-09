import { Router } from "express";
import type { Request, Response } from "express";
import { parseIdParam } from "../lib/params";
import { db } from "@workspace/db";
import { softwareTable, auditLogsTable } from "@workspace/db";
import { CreateSoftwareBody, UpdateSoftwareBody } from "@workspace/api-zod";
import { eq, and } from "drizzle-orm";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const { type, endOfLife } = req.query as Record<string, string>;
    const conditions = [];
    if (type) conditions.push(eq(softwareTable.type, type));
    if (endOfLife !== undefined) conditions.push(eq(softwareTable.endOfLife, endOfLife === "true"));
    const results = conditions.length
      ? await db.select().from(softwareTable).where(and(...conditions))
      : await db.select().from(softwareTable);
    return res.json(results.map(r => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() })));
  } catch (err) {
    req.log.error({ err }, "Error listing software");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const body = CreateSoftwareBody.parse(req.body);
    const [item] = await db.insert(softwareTable).values(body).returning();
    await db.insert(auditLogsTable).values({ action: "CREATE", entityType: "Software", entityId: item.id, entityName: item.name, userName: "System" });
    return res.status(201).json({ ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Error creating software");
    return res.status(400).json({ error: "Invalid request" });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseIdParam(req);
    const body = UpdateSoftwareBody.parse(req.body);
    const [item] = await db.update(softwareTable).set({ ...body, updatedAt: new Date() }).where(eq(softwareTable.id, id)).returning();
    if (!item) return res.status(404).json({ error: "Not found" });
    return res.json({ ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Error updating software");
    return res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseIdParam(req);
    const [item] = await db.delete(softwareTable).where(eq(softwareTable.id, id)).returning();
    if (!item) return res.status(404).json({ error: "Not found" });
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting software");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
