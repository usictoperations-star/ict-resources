import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { applicationsTable, releasesTable, documentsTable, vulnerabilitiesTable, softwareTable, repositoriesTable, domainsTable } from "@workspace/db";
import { CreateApplicationBody, UpdateApplicationBody } from "@workspace/api-zod";
import { eq, ilike, and, count, isNull, isNotNull, gte } from "drizzle-orm";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/summary", async (req: Request, res: Response) => {
  try {
    const apps = await db.select().from(applicationsTable).where(isNull(applicationsTable.deletedAt));

    const countBy = (key: keyof typeof apps[0]) => {
      const map: Record<string, number> = {};
      apps.forEach(a => {
        const val = (a[key] as string) ?? "Unknown";
        map[val] = (map[val] ?? 0) + 1;
      });
      return Object.entries(map).map(([k, v]) => ({ [key === "classification" ? "classification" : key as string]: k, count: v }));
    };

    return res.json({
      byCategory: apps.reduce((acc: Array<{ category: string; count: number }>, a) => {
        const cat = a.category ?? "Other";
        const existing = acc.find(x => x.category === cat);
        if (existing) existing.count++; else acc.push({ category: cat, count: 1 });
        return acc;
      }, []),
      byStatus: apps.reduce((acc: Array<{ status: string; count: number }>, a) => {
        const s = a.status ?? "Unknown";
        const existing = acc.find(x => x.status === s);
        if (existing) existing.count++; else acc.push({ status: s, count: 1 });
        return acc;
      }, []),
      byEnvironment: apps.reduce((acc: Array<{ environment: string; count: number }>, a) => {
        const e = a.environment ?? "Unknown";
        const existing = acc.find(x => x.environment === e);
        if (existing) existing.count++; else acc.push({ environment: e, count: 1 });
        return acc;
      }, []),
      byClassification: apps.reduce((acc: Array<{ classification: string; count: number }>, a) => {
        const c = a.classification ?? "Other";
        const existing = acc.find(x => x.classification === c);
        if (existing) existing.count++; else acc.push({ classification: c, count: 1 });
        return acc;
      }, []),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching application summary");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/", async (req: Request, res: Response) => {
  try {
    const { status, category, environment, search } = req.query as Record<string, string>;
    const conditions = [isNull(applicationsTable.deletedAt)];
    if (status) conditions.push(eq(applicationsTable.status, status));
    if (category) conditions.push(eq(applicationsTable.category, category));
    if (environment) conditions.push(eq(applicationsTable.environment, environment));
    if (search) conditions.push(ilike(applicationsTable.name, `%${search}%`));

    const results = await db.select().from(applicationsTable).where(and(...conditions));

    return res.json(results.map(a => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
      deletedAt: a.deletedAt ? a.deletedAt.toISOString() : null,
    })));
  } catch (err) {
    req.log.error({ err }, "Error listing applications");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const body = CreateApplicationBody.parse(req.body);
    const [app] = await db.insert(applicationsTable).values(body).returning();
    await logAudit(req, "CREATE", "Application", app.id, app.name);
    return res.status(201).json({ ...app, createdAt: app.createdAt.toISOString(), updatedAt: app.updatedAt.toISOString(), deletedAt: null });
  } catch (err) {
    req.log.error({ err }, "Error creating application");
    return res.status(400).json({ error: "Invalid request" });
  }
});

router.post("/:id/restore", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [app] = await db.update(applicationsTable)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(and(eq(applicationsTable.id, id), isNotNull(applicationsTable.deletedAt), gte(applicationsTable.deletedAt, cutoff)))
      .returning();
    if (!app) return res.status(404).json({ error: "Not found or outside the 30-day restore window" });
    await logAudit(req, "RESTORE", "Application", app.id, app.name);
    return res.json({ ...app, createdAt: app.createdAt.toISOString(), updatedAt: app.updatedAt.toISOString(), deletedAt: null });
  } catch (err) {
    req.log.error({ err }, "Error restoring application");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id/dependents", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [app] = await db.select({ id: applicationsTable.id }).from(applicationsTable).where(eq(applicationsTable.id, id));
    if (!app) return res.status(404).json({ error: "Not found" });

    const [[relCount], [docCount], [vulnCount], [swCount], [repoCount], [domCount]] = await Promise.all([
      db.select({ n: count() }).from(releasesTable).where(eq(releasesTable.applicationId, id)),
      db.select({ n: count() }).from(documentsTable).where(eq(documentsTable.applicationId, id)),
      db.select({ n: count() }).from(vulnerabilitiesTable).where(eq(vulnerabilitiesTable.applicationId, id)),
      db.select({ n: count() }).from(softwareTable).where(eq(softwareTable.applicationId, id)),
      db.select({ n: count() }).from(repositoriesTable).where(eq(repositoriesTable.applicationId, id)),
      db.select({ n: count() }).from(domainsTable).where(eq(domainsTable.applicationId, id)),
    ]);

    const releases = Number(relCount.n);
    const documents = Number(docCount.n);
    const vulnerabilities = Number(vulnCount.n);
    const software = Number(swCount.n);
    const repositories = Number(repoCount.n);
    const domains = Number(domCount.n);

    return res.json({
      releases,
      documents,
      vulnerabilities,
      software,
      repositories,
      domains,
      total: releases + documents + vulnerabilities + software + repositories + domains,
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching application dependents");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [app] = await db.select().from(applicationsTable).where(and(eq(applicationsTable.id, id), isNull(applicationsTable.deletedAt)));
    if (!app) return res.status(404).json({ error: "Not found" });
    return res.json({ ...app, createdAt: app.createdAt.toISOString(), updatedAt: app.updatedAt.toISOString(), deletedAt: app.deletedAt ? app.deletedAt.toISOString() : null });
  } catch (err) {
    req.log.error({ err }, "Error fetching application");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const body = UpdateApplicationBody.parse(req.body);
    const [app] = await db.update(applicationsTable)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(applicationsTable.id, id), isNull(applicationsTable.deletedAt)))
      .returning();
    if (!app) return res.status(404).json({ error: "Not found" });
    await logAudit(req, "UPDATE", "Application", app.id, app.name);
    return res.json({ ...app, createdAt: app.createdAt.toISOString(), updatedAt: app.updatedAt.toISOString(), deletedAt: null });
  } catch (err) {
    req.log.error({ err }, "Error updating application");
    return res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [app] = await db.update(applicationsTable)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(applicationsTable.id, id), isNull(applicationsTable.deletedAt)))
      .returning();
    if (!app) return res.status(404).json({ error: "Not found" });
    await logAudit(req, "DELETE", "Application", app.id, app.name);
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting application");
    return res.status(500).json({ error: "Internal server error" });
  }
});

async function logAudit(req: Request, action: string, entityType: string, entityId: number, entityName: string) {
  const { auditLogsTable: at } = await import("@workspace/db");
  try {
    await db.insert(at).values({ action, entityType, entityId, entityName, userName: "System" });
  } catch {}
}

export default router;
