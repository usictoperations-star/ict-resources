import { Router } from "express";
import type { Request, Response } from "express";
import { parseIdParam, parsePagination } from "../lib/params";
import { db } from "@workspace/db";
import { databasesTable, usersTable, applicationsTable } from "@workspace/db";
import { CreateDatabaseBody, UpdateDatabaseRecordBody } from "@workspace/api-zod";
import { eq, and, isNull, isNotNull, gte, count } from "drizzle-orm";
import { logAudit } from "../lib/audit";

const router = Router();

const fmt = (item: typeof databasesTable.$inferSelect, ownerName: string | null = null) => ({
  ...item,
  ownerName,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
  deletedAt: item.deletedAt ? item.deletedAt.toISOString() : null,
});

async function resolveOwnerName(ownerId: number | null | undefined): Promise<string | null> {
  if (!ownerId) return null;
  const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, ownerId));
  return user?.name ?? null;
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const { limit, offset } = parsePagination(req);
    const [[{ total }], results] = await Promise.all([
      db.select({ total: count() }).from(databasesTable).where(isNull(databasesTable.deletedAt)),
      db.select({ item: databasesTable, ownerName: usersTable.name })
        .from(databasesTable)
        .leftJoin(usersTable, eq(databasesTable.ownerId, usersTable.id))
        .where(isNull(databasesTable.deletedAt))
        .limit(limit)
        .offset(offset),
    ]);
    return res.json({ data: results.map(({ item, ownerName }) => fmt(item, ownerName ?? null)), total: Number(total) });
  } catch (err) {
    req.log.error({ err }, "Error listing databases");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const body = CreateDatabaseBody.parse(req.body);
    const [item] = await db.insert(databasesTable).values(body).returning();
    const ownerName = await resolveOwnerName(item.ownerId);
    await logAudit(req, "CREATE", "Database", item.id, item.name);
    return res.status(201).json(fmt(item, ownerName));
  } catch (err) {
    req.log.error({ err }, "Error creating database");
    return res.status(400).json({ error: "Invalid request" });
  }
});

router.post("/:id/restore", async (req: Request, res: Response) => {
  try {
    const id = parseIdParam(req);
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [item] = await db.update(databasesTable)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(and(eq(databasesTable.id, id), isNotNull(databasesTable.deletedAt), gte(databasesTable.deletedAt, cutoff)))
      .returning();
    if (!item) return res.status(404).json({ error: "Not found or outside the 30-day restore window" });
    const ownerName = await resolveOwnerName(item.ownerId);
    await logAudit(req, "RESTORE", "Database", item.id, item.name);
    return res.json(fmt(item, ownerName));
  } catch (err) {
    req.log.error({ err }, "Error restoring database");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id/dependents", async (req: Request, res: Response) => {
  try {
    const id = parseIdParam(req);
    const [item] = await db.select({ id: databasesTable.id }).from(databasesTable).where(and(eq(databasesTable.id, id), isNull(databasesTable.deletedAt)));
    if (!item) return res.status(404).json({ error: "Not found" });
    const [appsResult] = await db.select({ n: count() }).from(applicationsTable).where(and(eq(applicationsTable.databaseId, id), isNull(applicationsTable.deletedAt)));
    const applications = appsResult?.n ?? 0;
    return res.json({ applications, total: applications });
  } catch (err) {
    req.log.error({ err }, "Error fetching database dependents");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseIdParam(req);
    const [result] = await db
      .select({ item: databasesTable, ownerName: usersTable.name })
      .from(databasesTable)
      .leftJoin(usersTable, eq(databasesTable.ownerId, usersTable.id))
      .where(and(eq(databasesTable.id, id), isNull(databasesTable.deletedAt)));
    if (!result) return res.status(404).json({ error: "Not found" });
    return res.json(fmt(result.item, result.ownerName ?? null));
  } catch (err) {
    req.log.error({ err }, "Error fetching database");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseIdParam(req);
    const body = UpdateDatabaseRecordBody.parse(req.body);
    const [item] = await db.update(databasesTable)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(databasesTable.id, id), isNull(databasesTable.deletedAt)))
      .returning();
    if (!item) return res.status(404).json({ error: "Not found" });
    const ownerName = await resolveOwnerName(item.ownerId);
    return res.json(fmt(item, ownerName));
  } catch (err) {
    req.log.error({ err }, "Error updating database");
    return res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseIdParam(req);
    const [item] = await db.update(databasesTable)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(databasesTable.id, id), isNull(databasesTable.deletedAt)))
      .returning();
    if (!item) return res.status(404).json({ error: "Not found" });
    await logAudit(req, "DELETE", "Database", item.id, item.name);
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting database");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
