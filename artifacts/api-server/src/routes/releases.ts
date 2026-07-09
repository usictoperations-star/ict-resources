import { Router } from "express";
import type { Request, Response } from "express";
import { parseIdParam, parsePagination } from "../lib/params";
import { db } from "@workspace/db";
import { releasesTable, applicationsTable } from "@workspace/db";
import { CreateReleaseBody, UpdateReleaseBody } from "@workspace/api-zod";
import { eq, and, isNull, isNotNull, gte, count } from "drizzle-orm";
import { logAudit } from "../lib/audit";

function fmt(r: typeof releasesTable.$inferSelect, applicationName: string | null = null) {
  return {
    ...r,
    applicationName,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    deletedAt: r.deletedAt ? r.deletedAt.toISOString() : null,
  };
}

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const { applicationId, environment } = req.query as Record<string, string>;
    const { limit, offset } = parsePagination(req);
    const conditions = [isNull(releasesTable.deletedAt)];
    if (applicationId) conditions.push(eq(releasesTable.applicationId, parseInt(applicationId)));
    if (environment) conditions.push(eq(releasesTable.environment, environment));

    const [[{ total }], releases, apps] = await Promise.all([
      db.select({ total: count() }).from(releasesTable).where(and(...conditions)),
      db.select().from(releasesTable).where(and(...conditions)).limit(limit).offset(offset),
      db.select({ id: applicationsTable.id, name: applicationsTable.name }).from(applicationsTable),
    ]);
    const appMap = new Map(apps.map(a => [a.id, a.name]));

    return res.json({ data: releases.map(r => fmt(r, r.applicationId != null ? appMap.get(r.applicationId) ?? null : null)), total: Number(total) });
  } catch (err) {
    req.log.error({ err }, "Error listing releases");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const body = CreateReleaseBody.parse(req.body);
    const [item] = await db.insert(releasesTable).values(body).returning();
    await logAudit(req, "CREATE", "Release", item.id, `v${item.version}`);
    return res.status(201).json(fmt(item, null));
  } catch (err) {
    req.log.error({ err }, "Error creating release");
    return res.status(400).json({ error: "Invalid request" });
  }
});

router.post("/:id/restore", async (req: Request, res: Response) => {
  try {
    const id = parseIdParam(req);
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [item] = await db.update(releasesTable)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(and(eq(releasesTable.id, id), isNotNull(releasesTable.deletedAt), gte(releasesTable.deletedAt, cutoff)))
      .returning();
    if (!item) return res.status(404).json({ error: "Not found or outside the 30-day restore window" });
    const [app] = item.applicationId
      ? await db.select().from(applicationsTable).where(eq(applicationsTable.id, item.applicationId))
      : [undefined];
    await logAudit(req, "RESTORE", "Release", item.id, `v${item.version}`);
    return res.json(fmt(item, app?.name ?? null));
  } catch (err) {
    req.log.error({ err }, "Error restoring release");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseIdParam(req);
    const [item] = await db.select().from(releasesTable).where(and(eq(releasesTable.id, id), isNull(releasesTable.deletedAt)));
    if (!item) return res.status(404).json({ error: "Not found" });
    const [app] = item.applicationId
      ? await db.select().from(applicationsTable).where(eq(applicationsTable.id, item.applicationId))
      : [undefined];
    return res.json(fmt(item, app?.name ?? null));
  } catch (err) {
    req.log.error({ err }, "Error fetching release");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseIdParam(req);
    const body = UpdateReleaseBody.parse(req.body);
    const [item] = await db.update(releasesTable)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(releasesTable.id, id), isNull(releasesTable.deletedAt)))
      .returning();
    if (!item) return res.status(404).json({ error: "Not found" });
    return res.json(fmt(item, null));
  } catch (err) {
    req.log.error({ err }, "Error updating release");
    return res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseIdParam(req);
    const [item] = await db.update(releasesTable)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(releasesTable.id, id), isNull(releasesTable.deletedAt)))
      .returning();
    if (!item) return res.status(404).json({ error: "Not found" });
    await logAudit(req, "DELETE", "Release", item.id, `v${item.version}`);
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting release");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
