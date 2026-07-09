import { Router } from "express";
import type { Request, Response } from "express";
import { parseIdParam, parsePagination } from "../lib/params";
import { db } from "@workspace/db";
import { infrastructureTable, usersTable, applicationsTable } from "@workspace/db";
import { CreateInfrastructureBody, UpdateInfrastructureBody } from "@workspace/api-zod";
import { eq, and, isNull, isNotNull, gte, count } from "drizzle-orm";
import { logAudit } from "../lib/audit";
import { sendError } from "../lib/errors";

const router = Router();

const fmt = (item: typeof infrastructureTable.$inferSelect, ownerName: string | null = null) => ({
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
    const { type, status } = req.query as Record<string, string>;
    const { limit, offset } = parsePagination(req);
    const conditions = [isNull(infrastructureTable.deletedAt)];
    if (type) conditions.push(eq(infrastructureTable.type, type));
    if (status) conditions.push(eq(infrastructureTable.status, status));
    const [[{ total }], results] = await Promise.all([
      db.select({ total: count() }).from(infrastructureTable).where(and(...conditions)),
      db.select({ item: infrastructureTable, ownerName: usersTable.name })
        .from(infrastructureTable)
        .leftJoin(usersTable, eq(infrastructureTable.ownerId, usersTable.id))
        .where(and(...conditions))
        .limit(limit)
        .offset(offset),
    ]);
    return res.json({ data: results.map(({ item, ownerName }) => fmt(item, ownerName ?? null)), total: Number(total) });
  } catch (err) {
    req.log.error({ err }, "Error listing infrastructure");
    return sendError(res, 500, "Internal server error");
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const body = CreateInfrastructureBody.parse(req.body);
    const [item] = await db.insert(infrastructureTable).values(body).returning();
    const ownerName = await resolveOwnerName(item.ownerId);
    await logAudit(req, "CREATE", "Infrastructure", item.id, item.name);
    return res.status(201).json(fmt(item, ownerName));
  } catch (err) {
    req.log.error({ err }, "Error creating infrastructure");
    return sendError(res, 400, "Invalid request");
  }
});

router.post("/:id/restore", async (req: Request, res: Response) => {
  try {
    const id = parseIdParam(req);
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [item] = await db.update(infrastructureTable)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(and(eq(infrastructureTable.id, id), isNotNull(infrastructureTable.deletedAt), gte(infrastructureTable.deletedAt, cutoff)))
      .returning();
    if (!item) return sendError(res, 404, "Not found or outside the 30-day restore window");
    const ownerName = await resolveOwnerName(item.ownerId);
    await logAudit(req, "RESTORE", "Infrastructure", item.id, item.name);
    return res.json(fmt(item, ownerName));
  } catch (err) {
    req.log.error({ err }, "Error restoring infrastructure");
    return sendError(res, 500, "Internal server error");
  }
});

router.get("/:id/dependents", async (req: Request, res: Response) => {
  try {
    const id = parseIdParam(req);
    const [item] = await db.select({ id: infrastructureTable.id }).from(infrastructureTable).where(and(eq(infrastructureTable.id, id), isNull(infrastructureTable.deletedAt)));
    if (!item) return sendError(res, 404, "Not found");
    const [appsResult] = await db.select({ n: count() }).from(applicationsTable).where(and(eq(applicationsTable.infrastructureId, id), isNull(applicationsTable.deletedAt)));
    const applications = appsResult?.n ?? 0;
    return res.json({ applications, total: applications });
  } catch (err) {
    req.log.error({ err }, "Error fetching infrastructure dependents");
    return sendError(res, 500, "Internal server error");
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseIdParam(req);
    const [result] = await db
      .select({ item: infrastructureTable, ownerName: usersTable.name })
      .from(infrastructureTable)
      .leftJoin(usersTable, eq(infrastructureTable.ownerId, usersTable.id))
      .where(and(eq(infrastructureTable.id, id), isNull(infrastructureTable.deletedAt)));
    if (!result) return sendError(res, 404, "Not found");
    return res.json(fmt(result.item, result.ownerName ?? null));
  } catch (err) {
    req.log.error({ err }, "Error fetching infrastructure");
    return sendError(res, 500, "Internal server error");
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseIdParam(req);
    const body = UpdateInfrastructureBody.parse(req.body);
    const [item] = await db.update(infrastructureTable)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(infrastructureTable.id, id), isNull(infrastructureTable.deletedAt)))
      .returning();
    if (!item) return sendError(res, 404, "Not found");
    const ownerName = await resolveOwnerName(item.ownerId);
    return res.json(fmt(item, ownerName));
  } catch (err) {
    req.log.error({ err }, "Error updating infrastructure");
    return sendError(res, 400, "Invalid request");
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseIdParam(req);
    const [item] = await db.update(infrastructureTable)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(infrastructureTable.id, id), isNull(infrastructureTable.deletedAt)))
      .returning();
    if (!item) return sendError(res, 404, "Not found");
    await logAudit(req, "DELETE", "Infrastructure", item.id, item.name);
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting infrastructure");
    return sendError(res, 500, "Internal server error");
  }
});

export default router;
