import { Router } from "express";
import type { Request, Response } from "express";
import { parseIdParam, parsePagination } from "../lib/params";
import { db } from "@workspace/db";
import { repositoriesTable, auditLogsTable, usersTable } from "@workspace/db";
import { CreateRepositoryBody, UpdateRepositoryBody } from "@workspace/api-zod";
import { eq, isNull, isNotNull, and, gte, count } from "drizzle-orm";

async function resolveOwnerName(ownerId: number | null | undefined): Promise<string | null> {
  if (!ownerId) return null;
  const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, ownerId));
  return user?.name ?? null;
}

function fmt(r: typeof repositoriesTable.$inferSelect, ownerName: string | null = null) {
  return {
    ...r,
    ownerName,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    deletedAt: r.deletedAt ? r.deletedAt.toISOString() : null,
  };
}

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const { limit, offset } = parsePagination(req);
    const [[{ total }], results] = await Promise.all([
      db.select({ total: count() }).from(repositoriesTable).where(isNull(repositoriesTable.deletedAt)),
      db.select({ repo: repositoriesTable, ownerName: usersTable.name })
        .from(repositoriesTable)
        .leftJoin(usersTable, eq(repositoriesTable.ownerId, usersTable.id))
        .where(isNull(repositoriesTable.deletedAt))
        .limit(limit)
        .offset(offset),
    ]);
    return res.json({ data: results.map(({ repo: r, ownerName }) => fmt(r, ownerName ?? null)), total: Number(total) });
  } catch (err) {
    req.log.error({ err }, "Error listing repositories");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const body = CreateRepositoryBody.parse(req.body);
    const [item] = await db.insert(repositoriesTable).values(body).returning();
    const ownerName = await resolveOwnerName(item.ownerId);
    await db.insert(auditLogsTable).values({ action: "CREATE", entityType: "Repository", entityId: item.id, entityName: item.name, userName: "System" });
    return res.status(201).json(fmt(item, ownerName));
  } catch (err) {
    req.log.error({ err }, "Error creating repository");
    return res.status(400).json({ error: "Invalid request" });
  }
});

router.post("/:id/restore", async (req: Request, res: Response) => {
  try {
    const id = parseIdParam(req);
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [item] = await db.update(repositoriesTable)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(and(eq(repositoriesTable.id, id), isNotNull(repositoriesTable.deletedAt), gte(repositoriesTable.deletedAt, cutoff)))
      .returning();
    if (!item) return res.status(404).json({ error: "Not found or outside the 30-day restore window" });
    const ownerName = await resolveOwnerName(item.ownerId);
    await db.insert(auditLogsTable).values({ action: "RESTORE", entityType: "Repository", entityId: item.id, entityName: item.name, userName: "System" });
    return res.json(fmt(item, ownerName));
  } catch (err) {
    req.log.error({ err }, "Error restoring repository");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseIdParam(req);
    const [result] = await db
      .select({ repo: repositoriesTable, ownerName: usersTable.name })
      .from(repositoriesTable)
      .leftJoin(usersTable, eq(repositoriesTable.ownerId, usersTable.id))
      .where(and(eq(repositoriesTable.id, id), isNull(repositoriesTable.deletedAt)));
    if (!result) return res.status(404).json({ error: "Not found" });
    return res.json(fmt(result.repo, result.ownerName ?? null));
  } catch (err) {
    req.log.error({ err }, "Error fetching repository");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseIdParam(req);
    const body = UpdateRepositoryBody.parse(req.body);
    const [item] = await db.update(repositoriesTable)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(repositoriesTable.id, id), isNull(repositoriesTable.deletedAt)))
      .returning();
    if (!item) return res.status(404).json({ error: "Not found" });
    const ownerName = await resolveOwnerName(item.ownerId);
    return res.json(fmt(item, ownerName));
  } catch (err) {
    req.log.error({ err }, "Error updating repository");
    return res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseIdParam(req);
    const [item] = await db.update(repositoriesTable)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(repositoriesTable.id, id), isNull(repositoriesTable.deletedAt)))
      .returning();
    if (!item) return res.status(404).json({ error: "Not found" });
    await db.insert(auditLogsTable).values({ action: "DELETE", entityType: "Repository", entityId: item.id, entityName: item.name, userName: "System" });
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting repository");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
