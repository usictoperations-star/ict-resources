import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { vulnerabilitiesTable, applicationsTable, auditLogsTable } from "@workspace/db";
import { CreateVulnerabilityBody, UpdateVulnerabilityBody } from "@workspace/api-zod";
import { eq, and } from "drizzle-orm";

const router = Router();

router.get("/summary", async (req: Request, res: Response) => {
  try {
    const all = await db.select().from(vulnerabilitiesTable);
    const critical = all.filter(v => v.severity === "Critical").length;
    const high = all.filter(v => v.severity === "High").length;
    const medium = all.filter(v => v.severity === "Medium").length;
    const low = all.filter(v => v.severity === "Low").length;
    const open = all.filter(v => v.status === "Open").length;
    const inProgress = all.filter(v => v.status === "In Progress").length;
    const resolved = all.filter(v => v.status === "Resolved").length;
    const securityScore = all.length === 0 ? 100 : Math.max(0, Math.round(100 - critical * 20 - high * 10 - medium * 3 - low * 1));
    return res.json({ securityScore, critical, high, medium, low, open, inProgress, resolved });
  } catch (err) {
    req.log.error({ err }, "Error fetching security summary");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/vulnerabilities", async (req: Request, res: Response) => {
  try {
    const { severity, status } = req.query as Record<string, string>;
    const conditions = [];
    if (severity) conditions.push(eq(vulnerabilitiesTable.severity, severity));
    if (status) conditions.push(eq(vulnerabilitiesTable.status, status));

    const vulns = conditions.length
      ? await db.select().from(vulnerabilitiesTable).where(and(...conditions))
      : await db.select().from(vulnerabilitiesTable);

    const apps = await db.select().from(applicationsTable);
    const appMap = new Map(apps.map(a => [a.id, a.name]));

    return res.json(vulns.map(v => ({
      ...v,
      applicationName: v.applicationId ? appMap.get(v.applicationId) ?? null : null,
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Error listing vulnerabilities");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/vulnerabilities", async (req: Request, res: Response) => {
  try {
    const body = CreateVulnerabilityBody.parse(req.body);
    const [item] = await db.insert(vulnerabilitiesTable).values(body).returning();
    await db.insert(auditLogsTable).values({ action: "CREATE", entityType: "Vulnerability", entityId: item.id, entityName: item.title, userName: "System" });
    return res.status(201).json({ ...item, applicationName: null, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Error creating vulnerability");
    return res.status(400).json({ error: "Invalid request" });
  }
});

router.patch("/vulnerabilities/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const body = UpdateVulnerabilityBody.parse(req.body);
    const [item] = await db.update(vulnerabilitiesTable).set({ ...body, updatedAt: new Date() }).where(eq(vulnerabilitiesTable.id, id)).returning();
    if (!item) return res.status(404).json({ error: "Not found" });
    return res.json({ ...item, applicationName: null, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Error updating vulnerability");
    return res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/vulnerabilities/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [item] = await db.delete(vulnerabilitiesTable).where(eq(vulnerabilitiesTable.id, id)).returning();
    if (!item) return res.status(404).json({ error: "Not found" });
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting vulnerability");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
