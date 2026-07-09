import { Router } from "express";
import type { Request, Response } from "express";
import { parseIdParam, parsePagination } from "../lib/params";
import { db } from "@workspace/db";
import { documentsTable, applicationsTable, usersTable } from "@workspace/db";
import { CreateDocumentBody, UpdateDocumentBody } from "@workspace/api-zod";
import { eq, and, isNull, count } from "drizzle-orm";
import { logAudit } from "../lib/audit";
import { sendError } from "../lib/errors";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const { type, applicationId } = req.query as Record<string, string>;
    const { limit, offset } = parsePagination(req);
    const conditions = [isNull(documentsTable.deletedAt)];
    if (type) conditions.push(eq(documentsTable.type, type));
    if (applicationId) conditions.push(eq(documentsTable.applicationId, parseInt(applicationId)));

    const [[{ total }], docs, apps, users] = await Promise.all([
      db.select({ total: count() }).from(documentsTable).where(and(...conditions)),
      db.select().from(documentsTable).where(and(...conditions)).limit(limit).offset(offset),
      db.select({ id: applicationsTable.id, name: applicationsTable.name }).from(applicationsTable),
      db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable),
    ]);
    const appMap = new Map(apps.map(a => [a.id, a.name]));
    const userMap = new Map(users.map(u => [u.id, u.name]));

    return res.json({
      data: docs.map(d => ({
        ...d,
        applicationName: d.applicationId ? appMap.get(d.applicationId) ?? null : null,
        ownerName: d.ownerId ? userMap.get(d.ownerId) ?? null : null,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
        deletedAt: d.deletedAt ? d.deletedAt.toISOString() : null,
      })),
      total: Number(total),
    });
  } catch (err) {
    req.log.error({ err }, "Error listing documents");
    return sendError(res, 500, "Internal server error");
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const body = CreateDocumentBody.parse(req.body);
    const [item] = await db.insert(documentsTable).values(body).returning();
    await logAudit(req, "CREATE", "Document", item.id, item.title);
    const ownerName = item.ownerId ? (await db.select().from(usersTable).where(eq(usersTable.id, item.ownerId)))[0]?.name ?? null : null;
    return res.status(201).json({ ...item, applicationName: null, ownerName, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString(), deletedAt: null });
  } catch (err) {
    req.log.error({ err }, "Error creating document");
    return sendError(res, 400, "Invalid request");
  }
});

router.post("/:id/restore", async (req: Request, res: Response) => {
  try {
    const id = parseIdParam(req);
    const [item] = await db.update(documentsTable)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(eq(documentsTable.id, id))
      .returning();
    if (!item) return sendError(res, 404, "Not found");
    await logAudit(req, "RESTORE", "Document", item.id, item.title);
    return res.json({ ...item, applicationName: null, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString(), deletedAt: null });
  } catch (err) {
    req.log.error({ err }, "Error restoring document");
    return sendError(res, 500, "Internal server error");
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseIdParam(req);
    const [item] = await db.select().from(documentsTable).where(and(eq(documentsTable.id, id), isNull(documentsTable.deletedAt)));
    if (!item) return sendError(res, 404, "Not found");
    const appName = item.applicationId ? (await db.select().from(applicationsTable).where(eq(applicationsTable.id, item.applicationId)))[0]?.name ?? null : null;
    const ownerName = item.ownerId ? (await db.select().from(usersTable).where(eq(usersTable.id, item.ownerId)))[0]?.name ?? null : null;
    return res.json({ ...item, applicationName: appName, ownerName, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString(), deletedAt: item.deletedAt ? item.deletedAt.toISOString() : null });
  } catch (err) {
    req.log.error({ err }, "Error fetching document");
    return sendError(res, 500, "Internal server error");
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseIdParam(req);
    const body = UpdateDocumentBody.parse(req.body);
    const [item] = await db.update(documentsTable).set({ ...body, updatedAt: new Date() }).where(eq(documentsTable.id, id)).returning();
    if (!item) return sendError(res, 404, "Not found");
    return res.json({ ...item, applicationName: null, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString(), deletedAt: item.deletedAt ? item.deletedAt.toISOString() : null });
  } catch (err) {
    req.log.error({ err }, "Error updating document");
    return sendError(res, 400, "Invalid request");
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseIdParam(req);
    const [item] = await db.update(documentsTable)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(documentsTable.id, id), isNull(documentsTable.deletedAt)))
      .returning();
    if (!item) return sendError(res, 404, "Not found");
    await logAudit(req, "DELETE", "Document", item.id, item.title);
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting document");
    return sendError(res, 500, "Internal server error");
  }
});

export default router;
