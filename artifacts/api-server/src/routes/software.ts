import { Router } from "express";
import type { Request, Response } from "express";
import { parseIdParam, parsePagination } from "../lib/params";
import { db } from "@workspace/db";
import { softwareTable, usersTable } from "@workspace/db";
import { CreateSoftwareBody, UpdateSoftwareBody } from "@workspace/api-zod";
import { eq, and, isNull, count } from "drizzle-orm";
import { logAudit } from "../lib/audit";
import { sendError } from "../lib/errors";

async function resolveOwnerName(ownerId: number | null | undefined): Promise<string | null> {
  if (!ownerId) return null;
  const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, ownerId));
  return user?.name ?? null;
}

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const { type, endOfLife } = req.query as Record<string, string>;
    const { limit, offset } = parsePagination(req);
    const conditions = [isNull(softwareTable.deletedAt)];
    if (type) conditions.push(eq(softwareTable.type, type));
    if (endOfLife !== undefined) conditions.push(eq(softwareTable.endOfLife, endOfLife === "true"));
    const [[{ total }], results] = await Promise.all([
      db.select({ total: count() }).from(softwareTable).where(and(...conditions)),
      db.select({ sw: softwareTable, ownerName: usersTable.name })
        .from(softwareTable)
        .leftJoin(usersTable, eq(softwareTable.ownerId, usersTable.id))
        .where(and(...conditions))
        .limit(limit)
        .offset(offset),
    ]);
    return res.json({
      data: results.map(({ sw: r, ownerName }) => ({ ...r, ownerName: ownerName ?? null, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(), deletedAt: r.deletedAt ? r.deletedAt.toISOString() : null })),
      total: Number(total),
    });
  } catch (err) {
    req.log.error({ err }, "Error listing software");
    return sendError(res, 500, "Internal server error");
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const body = CreateSoftwareBody.parse(req.body);
    const [item] = await db.insert(softwareTable).values(body).returning();
    const ownerName = await resolveOwnerName(item.ownerId);
    await logAudit(req, "CREATE", "Software", item.id, item.name);
    return res.status(201).json({ ...item, ownerName, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString(), deletedAt: null });
  } catch (err) {
    req.log.error({ err }, "Error creating software");
    return sendError(res, 400, "Invalid request");
  }
});

router.post("/:id/restore", async (req: Request, res: Response) => {
  try {
    const id = parseIdParam(req);
    const [item] = await db.update(softwareTable)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(eq(softwareTable.id, id))
      .returning();
    if (!item) return sendError(res, 404, "Not found");
    const ownerName = await resolveOwnerName(item.ownerId);
    await logAudit(req, "RESTORE", "Software", item.id, item.name);
    return res.json({ ...item, ownerName, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString(), deletedAt: null });
  } catch (err) {
    req.log.error({ err }, "Error restoring software");
    return sendError(res, 500, "Internal server error");
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseIdParam(req);
    const body = UpdateSoftwareBody.parse(req.body);
    const [item] = await db.update(softwareTable).set({ ...body, updatedAt: new Date() }).where(eq(softwareTable.id, id)).returning();
    if (!item) return sendError(res, 404, "Not found");
    const ownerName = await resolveOwnerName(item.ownerId);
    return res.json({ ...item, ownerName, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString(), deletedAt: item.deletedAt ? item.deletedAt.toISOString() : null });
  } catch (err) {
    req.log.error({ err }, "Error updating software");
    return sendError(res, 400, "Invalid request");
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseIdParam(req);
    const [item] = await db.update(softwareTable)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(softwareTable.id, id), isNull(softwareTable.deletedAt)))
      .returning();
    if (!item) return sendError(res, 404, "Not found");
    await logAudit(req, "DELETE", "Software", item.id, item.name);
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting software");
    return sendError(res, 500, "Internal server error");
  }
});

export default router;
