import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import {
  applicationsTable, infrastructureTable, databasesTable, domainsTable,
  repositoriesTable, softwareTable, vulnerabilitiesTable
} from "@workspace/db";
import { isNull } from "drizzle-orm";
import { sendError } from "../lib/errors";

const router = Router();

router.get("/inventory", async (req: Request, res: Response) => {
  try {
    const [apps, infra, dbs, domains, repos, sw] = await Promise.all([
      db.select().from(applicationsTable).where(isNull(applicationsTable.deletedAt)),
      db.select().from(infrastructureTable).where(isNull(infrastructureTable.deletedAt)),
      db.select().from(databasesTable).where(isNull(databasesTable.deletedAt)),
      db.select().from(domainsTable),
      db.select().from(repositoriesTable),
      db.select().from(softwareTable),
    ]);

    const byCategory = apps.reduce((acc: Array<{ category: string; count: number }>, a) => {
      const cat = a.category ?? "Other";
      const existing = acc.find(x => x.category === cat);
      if (existing) existing.count++; else acc.push({ category: cat, count: 1 });
      return acc;
    }, []);

    const serversByType = infra.reduce((acc: Array<{ type: string; count: number }>, i) => {
      const t = i.type ?? "Other";
      const existing = acc.find(x => x.type === t);
      if (existing) existing.count++; else acc.push({ type: t, count: 1 });
      return acc;
    }, []);

    return res.json({
      generatedAt: new Date().toISOString(),
      totalApplications: apps.length,
      totalServers: infra.length,
      totalDatabases: dbs.length,
      totalDomains: domains.length,
      totalRepositories: repos.length,
      totalSoftware: sw.length,
      applicationsByCategory: byCategory,
      serversByType,
    });
  } catch (err) {
    req.log.error({ err }, "Error generating inventory report");
    return sendError(res, 500, "Internal server error");
  }
});

router.get("/security", async (req: Request, res: Response) => {
  try {
    const [vulns, apps] = await Promise.all([
      db.select().from(vulnerabilitiesTable),
      db.select().from(applicationsTable).where(isNull(applicationsTable.deletedAt)),
    ]);
    const appMap = new Map(apps.map(a => [a.id, a.name]));

    const criticalCount = vulns.filter(v => v.severity === "Critical").length;
    const highCount = vulns.filter(v => v.severity === "High").length;
    const mediumCount = vulns.filter(v => v.severity === "Medium").length;
    const lowCount = vulns.filter(v => v.severity === "Low").length;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const resolvedLast30Days = vulns.filter(v => v.status === "Resolved" && v.updatedAt >= thirtyDaysAgo).length;

    const overallScore = vulns.length === 0 ? 100 : Math.max(0, Math.round(100 - criticalCount * 20 - highCount * 10 - mediumCount * 3 - lowCount * 1));

    // Top affected apps
    const appVulnCount: Record<number, number> = {};
    vulns.forEach(v => { if (v.applicationId) appVulnCount[v.applicationId] = (appVulnCount[v.applicationId] ?? 0) + 1; });
    const topAffectedApplications = Object.entries(appVulnCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([id, count]) => ({ applicationName: appMap.get(parseInt(id)) ?? `App ${id}`, count }));

    return res.json({
      generatedAt: new Date().toISOString(),
      overallScore,
      totalVulnerabilities: vulns.length,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      resolvedLast30Days,
      topAffectedApplications,
    });
  } catch (err) {
    req.log.error({ err }, "Error generating security report");
    return sendError(res, 500, "Internal server error");
  }
});

router.get("/renewals", async (req: Request, res: Response) => {
  try {
    const domains = await db.select().from(domainsTable);
    const now = new Date();
    const in180Days = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
    const items: Array<{ id: number; type: string; name: string; expiryDate: string; daysUntilExpiry: number; status: string }> = [];

    domains.forEach(d => {
      if (d.sslExpiry) {
        const date = new Date(d.sslExpiry);
        if (date <= in180Days) {
          const days = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          items.push({ id: d.id * 100 + 1, type: "SSL", name: d.name, expiryDate: d.sslExpiry, daysUntilExpiry: days, status: days <= 0 ? "Expired" : days <= 14 ? "Critical" : days <= 30 ? "Warning" : "OK" });
        }
      }
      if (d.registrationExpiry) {
        const date = new Date(d.registrationExpiry);
        if (date <= in180Days) {
          const days = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          items.push({ id: d.id * 100 + 2, type: "Domain", name: d.name, expiryDate: d.registrationExpiry, daysUntilExpiry: days, status: days <= 0 ? "Expired" : days <= 14 ? "Critical" : days <= 30 ? "Warning" : "OK" });
        }
      }
    });

    return res.json(items.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry));
  } catch (err) {
    req.log.error({ err }, "Error generating renewal report");
    return sendError(res, 500, "Internal server error");
  }
});

export default router;
