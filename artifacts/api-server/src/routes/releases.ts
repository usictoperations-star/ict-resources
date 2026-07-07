import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { releasesTable, applicationsTable, auditLogsTable } from "@workspace/db";
import { CreateReleaseBody, UpdateReleaseBody } from "@workspace/api-zod";
import { eq, and } from "drizzle-orm";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const { applicationId, environment } = req.query as Record<string, string>;
    const conditions = [];
    if (applicationId) conditions.push(eq(releasesTable.applicationId, parseInt(applicationId)));
    if (environment) conditions.push(eq(releasesTable.environment, environment));

    const releases = conditions.length
      ? await db.select().from(releasesTable).where(and(...conditions))
      : await db.select().from(releasesTable);

    const apps = await db.select().from(applicationsTable);
    const appMap = new Map(apps.map(a => [a.id, a.name]));

    return res.json(releases.map(r => ({
      ...r,
      applicationName: appMap.get(r.applicationId) ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })));
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
    return res.status(201).json({ ...item, applicationName: null, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Error creating release");
    return res.status(400).json({ error: "Invalid request" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [item] = await db.select().from(releasesTable).where(eq(releasesTable.id, id));
    if (!item) return res.status(404).json({ error: "Not found" });
    const [app] = await db.select().from(applicationsTable).where(eq(applicationsTable.id, item.applicationId));
    return res.json({ ...item, applicationName: app?.name ?? null, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Error fetching release");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const body = UpdateReleaseBody.parse(req.body);
    const [item] = await db.update(releasesTable).set({ ...body, updatedAt: new Date() }).where(eq(releasesTable.id, id)).returning();
    if (!item) return res.status(404).json({ error: "Not found" });
    return res.json({ ...item, applicationName: null, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Error updating release");
    return res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [item] = await db.delete(releasesTable).where(eq(releasesTable.id, id)).returning();
    if (!item) return res.status(404).json({ error: "Not found" });
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting release");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
