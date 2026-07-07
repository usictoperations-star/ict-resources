import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { applicationsTable } from "@workspace/db";
import { CreateApplicationBody, UpdateApplicationBody } from "@workspace/api-zod";
import { eq, ilike, and } from "drizzle-orm";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/summary", async (req: Request, res: Response) => {
  try {
    const apps = await db.select().from(applicationsTable);

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
    let query = db.select().from(applicationsTable);
    const conditions = [];
    if (status) conditions.push(eq(applicationsTable.status, status));
    if (category) conditions.push(eq(applicationsTable.category, category));
    if (environment) conditions.push(eq(applicationsTable.environment, environment));
    if (search) conditions.push(ilike(applicationsTable.name, `%${search}%`));

    const results = conditions.length
      ? await db.select().from(applicationsTable).where(and(...conditions))
      : await db.select().from(applicationsTable);

    return res.json(results.map(a => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
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
    return res.status(201).json({ ...app, createdAt: app.createdAt.toISOString(), updatedAt: app.updatedAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Error creating application");
    return res.status(400).json({ error: "Invalid request" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [app] = await db.select().from(applicationsTable).where(eq(applicationsTable.id, id));
    if (!app) return res.status(404).json({ error: "Not found" });
    return res.json({ ...app, createdAt: app.createdAt.toISOString(), updatedAt: app.updatedAt.toISOString() });
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
      .where(eq(applicationsTable.id, id))
      .returning();
    if (!app) return res.status(404).json({ error: "Not found" });
    await logAudit(req, "UPDATE", "Application", app.id, app.name);
    return res.json({ ...app, createdAt: app.createdAt.toISOString(), updatedAt: app.updatedAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Error updating application");
    return res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [app] = await db.delete(applicationsTable).where(eq(applicationsTable.id, id)).returning();
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
