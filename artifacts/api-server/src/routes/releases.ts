import { Router } from "express";
import type { Request, Response } from "express";
import { parseIdParam } from "../lib/params";
import { db } from "@workspace/db";
import { releasesTable, applicationsTable, auditLogsTable } from "@workspace/db";
import { CreateReleaseBody, UpdateReleaseBody } from "@workspace/api-zod";
import { eq, and, isNull, isNotNull, gte } from "drizzle-orm";

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
    const conditions = [isNull(releasesTable.deletedAt)];
    if (applicationId) conditions.push(eq(releasesTable.applicationId, parseInt(applicationId)));
    if (environment) conditions.push(eq(releasesTable.environment, environment));

    const releases = await db.select().from(releasesTable).where(and(...conditions));

    const apps = await db.select().from(applicationsTable);
    const appMap = new Map(apps.map(a => [a.id, a.name]));

    return res.json(releases.map(r => fmt(r, appMap.get(r.applicationId) ?? null)));
  } catch (err) {
    req.log.error({ err }, "Error listing releases");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const body = CreateReleaseBody.parse(req.body);
    const [item] = await db.insert(releasesTable).values(body).returning();
    await db.insert(auditLogsTable).values({ action: "CREATE", entityType: "Release", entityId: item.id, entityName: `v${item.version}`, userName: "System" });
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
    await db.insert(auditLogsTable).values({ action: "RESTORE", entityType: "Release", entityId: item.id, entityName: `v${item.version}`, userName: "System" });
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
    await db.insert(auditLogsTable).values({ action: "DELETE", entityType: "Release", entityId: item.id, entityName: `v${item.version}`, userName: "System" });
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting release");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
