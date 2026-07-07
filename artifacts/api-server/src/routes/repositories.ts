import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { repositoriesTable, auditLogsTable } from "@workspace/db";
import { CreateRepositoryBody, UpdateRepositoryBody } from "@workspace/api-zod";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const results = await db.select().from(repositoriesTable);
    return res.json(results.map(r => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() })));
  } catch (err) {
    req.log.error({ err }, "Error listing repositories");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const body = CreateRepositoryBody.parse(req.body);
    const [item] = await db.insert(repositoriesTable).values(body).returning();
    await db.insert(auditLogsTable).values({ action: "CREATE", entityType: "Repository", entityId: item.id, entityName: item.name, userName: "System" });
    return res.status(201).json({ ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Error creating repository");
    return res.status(400).json({ error: "Invalid request" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [item] = await db.select().from(repositoriesTable).where(eq(repositoriesTable.id, id));
    if (!item) return res.status(404).json({ error: "Not found" });
    return res.json({ ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Error fetching repository");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const body = UpdateRepositoryBody.parse(req.body);
    const [item] = await db.update(repositoriesTable).set({ ...body, updatedAt: new Date() }).where(eq(repositoriesTable.id, id)).returning();
    if (!item) return res.status(404).json({ error: "Not found" });
    return res.json({ ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Error updating repository");
    return res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [item] = await db.delete(repositoriesTable).where(eq(repositoriesTable.id, id)).returning();
    if (!item) return res.status(404).json({ error: "Not found" });
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting repository");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
