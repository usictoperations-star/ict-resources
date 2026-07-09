import { Router } from "express";
import type { Request, Response } from "express";
import { parseIdParam } from "../lib/params";
import { db } from "@workspace/db";
import { repositoriesTable, auditLogsTable, usersTable } from "@workspace/db";
import { CreateRepositoryBody, UpdateRepositoryBody } from "@workspace/api-zod";
import { eq } from "drizzle-orm";

async function resolveOwnerName(ownerId: number | null | undefined): Promise<string | null> {
  if (!ownerId) return null;
  const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, ownerId));
  return user?.name ?? null;
}

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const results = await db
      .select({ repo: repositoriesTable, ownerName: usersTable.name })
      .from(repositoriesTable)
      .leftJoin(usersTable, eq(repositoriesTable.ownerId, usersTable.id));
    return res.json(results.map(({ repo: r, ownerName }) => ({ ...r, ownerName: ownerName ?? null, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() })));
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
    return res.status(201).json({ ...item, ownerName, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Error creating repository");
    return res.status(400).json({ error: "Invalid request" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseIdParam(req);
    const [result] = await db
      .select({ repo: repositoriesTable, ownerName: usersTable.name })
      .from(repositoriesTable)
      .leftJoin(usersTable, eq(repositoriesTable.ownerId, usersTable.id))
      .where(eq(repositoriesTable.id, id));
    if (!result) return res.status(404).json({ error: "Not found" });
    return res.json({ ...result.repo, ownerName: result.ownerName ?? null, createdAt: result.repo.createdAt.toISOString(), updatedAt: result.repo.updatedAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Error fetching repository");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseIdParam(req);
    const body = UpdateRepositoryBody.parse(req.body);
    const [item] = await db.update(repositoriesTable).set({ ...body, updatedAt: new Date() }).where(eq(repositoriesTable.id, id)).returning();
    if (!item) return res.status(404).json({ error: "Not found" });
    const ownerName = await resolveOwnerName(item.ownerId);
    return res.json({ ...item, ownerName, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Error updating repository");
    return res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseIdParam(req);
    const [item] = await db.delete(repositoriesTable).where(eq(repositoriesTable.id, id)).returning();
    if (!item) return res.status(404).json({ error: "Not found" });
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting repository");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
