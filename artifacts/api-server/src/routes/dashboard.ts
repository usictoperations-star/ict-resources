import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { applicationsTable, infrastructureTable, databasesTable, domainsTable, repositoriesTable, vulnerabilitiesTable, releasesTable, auditLogsTable } from "@workspace/db";
import { sql, gt, isNull } from "drizzle-orm";
import { cache, DASHBOARD_TTL_MS } from "../lib/cache";
import { sendError } from "../lib/errors";

const router = Router();

router.get("/stats", async (req: Request, res: Response) => {
  try {
    const hit = cache.get<Record<string, unknown>>("dashboard:stats");
    if (hit) return res.json({ ...hit.value, cachedAt: hit.cachedAt });

    const [
      appRows,
      infraRows,
      dbRows,
      domainRows,
      repoRows,
      vulnRows,
      releaseRows,
    ] = await Promise.all([
      db.select().from(applicationsTable).where(isNull(applicationsTable.deletedAt)),
      db.select().from(infrastructureTable).where(isNull(infrastructureTable.deletedAt)),
      db.select().from(databasesTable).where(isNull(databasesTable.deletedAt)),
      db.select().from(domainsTable),
      db.select().from(repositoriesTable),
      db.select().from(vulnerabilitiesTable),
      db.select().from(releasesTable),
    ]);

    const totalApplications = appRows.length;
    const productionSystems = appRows.filter(a => a.environment === "Production").length;
    const testSystems = appRows.filter(a => a.environment === "Testing").length;
    const mobileApps = appRows.filter(a => a.classification === "Mobile App").length;
    const websites = appRows.filter(a => a.classification === "Website").length;
    const apis = appRows.filter(a => a.classification === "API").length;
    const servers = infraRows.filter(i => ["Server", "VPS"].includes(i.type)).length;
    const sslCertificates = domainRows.filter(d => d.sslExpiry).length;
    const criticalVulnerabilities = vulnRows.filter(v => v.severity === "Critical" && v.status === "Open").length;
    const highVulnerabilities = vulnRows.filter(v => v.severity === "High" && v.status === "Open").length;
    const openIncidents = vulnRows.filter(v => v.status === "Open").length;

    const now = new Date();
    const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const upcomingRenewals = domainRows.filter(d => {
      if (!d.sslExpiry && !d.registrationExpiry) return false;
      const expiry = d.sslExpiry || d.registrationExpiry;
      if (!expiry) return false;
      const date = new Date(expiry);
      return date >= now && date <= in90Days;
    }).length;

    const resolvedVulns = vulnRows.filter(v => v.status !== "Open").length;
    const total = vulnRows.length;
    const securityScore = total === 0 ? 100 : Math.max(0, Math.round(100 - (criticalVulnerabilities * 20 + highVulnerabilities * 10 + openIncidents * 2)));

    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const recentReleases = releaseRows.filter(r => r.createdAt > new Date(thirtyDaysAgo)).length;

    const result = {
      totalApplications,
      productionSystems,
      testSystems,
      mobileApps,
      websites,
      apis,
      databases: dbRows.length,
      servers,
      domains: domainRows.length,
      sslCertificates,
      repositories: repoRows.length,
      openIncidents,
      criticalVulnerabilities,
      highVulnerabilities,
      upcomingRenewals,
      securityScore,
      recentReleases,
      resolvedVulns,
    };

    const cachedAt = cache.set("dashboard:stats", result, DASHBOARD_TTL_MS);
    return res.json({ ...result, cachedAt });
  } catch (err) {
    req.log.error({ err }, "Error fetching dashboard stats");
    return sendError(res, 500, "Internal server error");
  }
});

router.get("/alerts", async (req: Request, res: Response) => {
  try {
    const hit = cache.get<unknown[]>("dashboard:alerts");
    if (hit) {
      res.setHeader("X-Cached-At", hit.cachedAt);
      return res.json(hit.value);
    }

    const vulns = await db.select().from(vulnerabilitiesTable).limit(10);
    const domains = await db.select().from(domainsTable);
    const alerts: Array<{ id: number; type: string; severity: string; title: string; message: string; dueDate: string | null; createdAt: string }> = [];
    let id = 1;

    vulns.filter(v => v.severity === "Critical" && v.status === "Open").slice(0, 3).forEach(v => {
      alerts.push({
        id: id++,
        type: "vulnerability",
        severity: "critical",
        title: `Critical Vulnerability: ${v.title}`,
        message: v.affectedComponent ? `Affects: ${v.affectedComponent}` : "Requires immediate attention",
        dueDate: null,
        createdAt: v.createdAt.toISOString(),
      });
    });

    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    domains.forEach(d => {
      const expiry = d.sslExpiry || d.registrationExpiry;
      if (expiry) {
        const date = new Date(expiry);
        if (date >= now && date <= in30Days) {
          const days = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          alerts.push({
            id: id++,
            type: "renewal",
            severity: days <= 7 ? "critical" : "warning",
            title: `${d.sslExpiry ? "SSL" : "Domain"} Expiring: ${d.name}`,
            message: `Expires in ${days} day${days !== 1 ? "s" : ""}`,
            dueDate: expiry,
            createdAt: now.toISOString(),
          });
        }
      }
    });

    const sliced = alerts.slice(0, 10);
    const cachedAt = cache.set("dashboard:alerts", sliced, DASHBOARD_TTL_MS);
    res.setHeader("X-Cached-At", cachedAt);
    return res.json(sliced);
  } catch (err) {
    req.log.error({ err }, "Error fetching alerts");
    return sendError(res, 500, "Internal server error");
  }
});

router.get("/activity", async (req: Request, res: Response) => {
  try {
    const hit = cache.get<unknown[]>("dashboard:activity");
    if (hit) {
      res.setHeader("X-Cached-At", hit.cachedAt);
      return res.json(hit.value);
    }

    const logs = await db.select().from(auditLogsTable).orderBy(sql`${auditLogsTable.createdAt} DESC`).limit(20);
    const activity = logs.map(l => ({
      id: l.id,
      action: l.action,
      entityType: l.entityType,
      entityName: l.entityName ?? l.entityType,
      user: l.userName ?? "System",
      createdAt: l.createdAt.toISOString(),
    }));

    const cachedAt = cache.set("dashboard:activity", activity, DASHBOARD_TTL_MS);
    res.setHeader("X-Cached-At", cachedAt);
    return res.json(activity);
  } catch (err) {
    req.log.error({ err }, "Error fetching activity");
    return sendError(res, 500, "Internal server error");
  }
});

router.get("/activity-chart", async (req: Request, res: Response) => {
  try {
    const hit = cache.get<unknown[]>("dashboard:activity-chart");
    if (hit) {
      res.setHeader("X-Cached-At", hit.cachedAt);
      return res.json(hit.value);
    }

    const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const logs = await db
      .select()
      .from(auditLogsTable)
      .where(gt(auditLogsTable.createdAt, sevenDaysAgo));

    const countMap = new Map<string, { total: number; creates: number; updates: number; deletes: number }>();

    for (const log of logs) {
      const d = log.createdAt;
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const entry = countMap.get(iso) ?? { total: 0, creates: 0, updates: 0, deletes: 0 };
      entry.total++;
      const action = (log.action ?? "").toUpperCase();
      if (action.includes("CREATE") || action.includes("INSERT")) entry.creates++;
      else if (action.includes("UPDATE")) entry.updates++;
      else if (action.includes("DELETE")) entry.deletes++;
      countMap.set(iso, entry);
    }

    const points = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
      const counts = countMap.get(iso) ?? { total: 0, creates: 0, updates: 0, deletes: 0 };
      points.push({ date: DAY_LABELS[day.getDay()], isoDate: iso, ...counts });
    }

    const cachedAt = cache.set("dashboard:activity-chart", points, DASHBOARD_TTL_MS);
    res.setHeader("X-Cached-At", cachedAt);
    return res.json(points);
  } catch (err) {
    req.log.error({ err }, "Error fetching activity chart");
    return sendError(res, 500, "Internal server error");
  }
});

export default router;
