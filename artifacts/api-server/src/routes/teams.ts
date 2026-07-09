import { Router } from "express";
import type { Request, Response } from "express";
import { parseIdParam, parsePagination } from "../lib/params";
import { db } from "@workspace/db";
import { teamsTable, auditLogsTable } from "@workspace/db";
import { CreateTeamBody, UpdateTeamBody } from "@workspace/api-zod";
import { eq, count } from "drizzle-orm";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const { limit, offset } = parsePagination(req);
    const [[{ total }], results] = await Promise.all([
      db.select({ total: count() }).from(teamsTable),
      db.select().from(teamsTable).limit(limit).offset(offset),
    ]);
    return res.json({ data: results.map(t => ({ ...t, createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString() })), total: Number(total) });
  } catch (err) {
    req.log.error({ err }, "Error listing teams");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const body = CreateTeamBody.parse(req.body);
    const [item] = await db.insert(teamsTable).values(body).returning();
    await db.insert(auditLogsTable).values({ action: "CREATE", entityType: "Team", entityId: item.id, entityName: item.name, userName: "System" });
    return res.status(201).json({ ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Error creating team");
    return res.status(400).json({ error: "Invalid request" });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseIdParam(req);
    const body = UpdateTeamBody.parse(req.body);
    const [item] = await db.update(teamsTable).set({ ...body, updatedAt: new Date() }).where(eq(teamsTable.id, id)).returning();
    if (!item) return res.status(404).json({ error: "Not found" });
    return res.json({ ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Error updating team");
    return res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseIdParam(req);
    const [item] = await db.delete(teamsTable).where(eq(teamsTable.id, id)).returning();
    if (!item) return res.status(404).json({ error: "Not found" });
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting team");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
