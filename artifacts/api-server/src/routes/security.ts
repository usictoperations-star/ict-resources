import { Router } from "express";
import type { Request, Response } from "express";
import { parseIdParam, parsePagination } from "../lib/params";
import { cache, DASHBOARD_TTL_MS } from "../lib/cache";
import { db } from "@workspace/db";
import {
  vulnerabilitiesTable,
  applicationsTable,
  auditLogsTable,
  infrastructureTable,
  domainsTable,
  databasesTable,
  repositoriesTable,
  softwareTable,
  usersTable,
} from "@workspace/db";
import { CreateVulnerabilityBody, UpdateVulnerabilityBody } from "@workspace/api-zod";
import { eq, and, isNull, count } from "drizzle-orm";

const router = Router();

const SCAN_STALE_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

function daysRemaining(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const hit = cache.get<Record<string, unknown>>("security:dashboard");
    if (hit) return res.json({ ...hit.value, cachedAt: hit.cachedAt });

    const [apps, infra, domains, databases, repos, software, users, vulns] = await Promise.all([
      db.select().from(applicationsTable).where(isNull(applicationsTable.deletedAt)),
      db.select().from(infrastructureTable).where(isNull(infrastructureTable.deletedAt)),
      db.select().from(domainsTable).where(isNull(domainsTable.deletedAt)),
      db.select().from(databasesTable).where(isNull(databasesTable.deletedAt)),
      db.select().from(repositoriesTable).where(isNull(repositoriesTable.deletedAt)),
      db.select().from(softwareTable).where(isNull(softwareTable.deletedAt)),
      db.select().from(usersTable),
      db.select().from(vulnerabilitiesTable).where(isNull(vulnerabilitiesTable.deletedAt)),
    ]);

    const now = Date.now();

    const systemsInProduction = apps.filter(
      a => a.environment === "Production" && a.status === "Active"
    ).length;

    const serversMissingPatches = infra
      .filter(i => i.patchStatus !== "Up to Date")
      .map(i => ({ id: i.id, name: i.name, patchStatus: i.patchStatus, lastPatchedAt: i.lastPatchedAt }));

    const criticalByApp = new Map<number | null, { applicationId: number | null; applicationName: string | null; criticalCount: number }>();
    const appMap = new Map(apps.map(a => [a.id, a.name]));
    vulns
      .filter(v => v.severity === "Critical")
      .forEach(v => {
        const key = v.applicationId ?? null;
        const existing = criticalByApp.get(key);
        if (existing) {
          existing.criticalCount++;
        } else {
          criticalByApp.set(key, {
            applicationId: key,
            applicationName: key ? appMap.get(key) ?? null : null,
            criticalCount: 1,
          });
        }
      });

    const sslCertificatesExpiringSoon = domains
      .filter(d => {
        const remaining = daysRemaining(d.sslExpiry);
        return remaining !== null && remaining <= 30 && remaining >= 0;
      })
      .map(d => ({ id: d.id, name: d.name, sslExpiry: d.sslExpiry, daysRemaining: daysRemaining(d.sslExpiry) }));

    const domainsExpiringSoon = domains
      .filter(d => {
        const remaining = daysRemaining(d.registrationExpiry);
        return remaining !== null && remaining <= 30 && remaining >= 0;
      })
      .map(d => ({ id: d.id, name: d.name, registrationExpiry: d.registrationExpiry, daysRemaining: daysRemaining(d.registrationExpiry) }));

    const failedBackups = databases
      .filter(d => d.lastBackupStatus === "Failed")
      .map(d => ({ id: d.id, name: d.name, lastBackupStatus: d.lastBackupStatus, lastBackupAt: d.lastBackupAt }));

    const adminUsers = users
      .filter(u => Array.isArray(u.roles) ? u.roles.includes("admin") : false)
      .map(u => ({ id: u.id, name: u.name, email: u.email, department: u.department }));

    const reposWithExposedSecrets = repos
      .filter(r => r.secretsExposed)
      .map(r => ({ id: r.id, name: r.name, lastScannedAt: r.lastScannedAt }));

    const outdatedDependencies = software
      .filter(s => !s.supported || s.endOfLife)
      .map(s => ({ id: s.id, name: s.name, installedVersion: s.installedVersion, latestVersion: s.latestVersion, endOfLife: s.endOfLife }));

    const applicationsNotRecentlyScanned = apps
      .filter(a => {
        if (!a.lastSecurityScanAt) return true;
        const scanned = new Date(a.lastSecurityScanAt).getTime();
        if (Number.isNaN(scanned)) return true;
        return now - scanned > SCAN_STALE_DAYS_MS;
      })
      .map(a => ({ id: a.id, name: a.name, lastSecurityScanAt: a.lastSecurityScanAt }));

    const result = {
      systemsInProduction,
      serversMissingPatches,
      applicationsWithCriticalVulnerabilities: Array.from(criticalByApp.values()),
      sslCertificatesExpiringSoon,
      domainsExpiringSoon,
      failedBackups,
      adminUsers,
      reposWithExposedSecrets,
      outdatedDependencies,
      applicationsNotRecentlyScanned,
      generatedAt: new Date().toISOString(),
    };
    const cachedAt = cache.set("security:dashboard", result, DASHBOARD_TTL_MS);
    return res.json({ ...result, cachedAt });
  } catch (err) {
    req.log.error({ err }, "Error fetching security dashboard");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/summary", async (req: Request, res: Response) => {
  try {
    const all = await db.select().from(vulnerabilitiesTable).where(isNull(vulnerabilitiesTable.deletedAt));
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
    const { limit, offset } = parsePagination(req);
    const conditions = [isNull(vulnerabilitiesTable.deletedAt)];
    if (severity) conditions.push(eq(vulnerabilitiesTable.severity, severity));
    if (status) conditions.push(eq(vulnerabilitiesTable.status, status));

    const [[{ total }], vulns, apps, owners] = await Promise.all([
      db.select({ total: count() }).from(vulnerabilitiesTable).where(and(...conditions)),
      db.select().from(vulnerabilitiesTable).where(and(...conditions)).limit(limit).offset(offset),
      db.select({ id: applicationsTable.id, name: applicationsTable.name }).from(applicationsTable),
      db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable),
    ]);
    const appMap = new Map(apps.map(a => [a.id, a.name]));
    const ownerMap = new Map(owners.map(u => [u.id, u.name]));

    return res.json({
      data: vulns.map(v => ({
        ...v,
        applicationName: v.applicationId ? appMap.get(v.applicationId) ?? null : null,
        ownerName: v.ownerId ? ownerMap.get(v.ownerId) ?? null : null,
        createdAt: v.createdAt.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
        deletedAt: v.deletedAt ? v.deletedAt.toISOString() : null,
      })),
      total: Number(total),
    });
  } catch (err) {
    req.log.error({ err }, "Error listing vulnerabilities");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/vulnerabilities", async (req: Request, res: Response) => {
  try {
    const body = CreateVulnerabilityBody.parse(req.body);
    const [item] = await db.insert(vulnerabilitiesTable).values(body).returning();
    const ownerRow = item.ownerId ? await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, item.ownerId)).limit(1) : [];
    await db.insert(auditLogsTable).values({ action: "CREATE", entityType: "Vulnerability", entityId: item.id, entityName: item.title, userName: "System" });
    return res.status(201).json({ ...item, applicationName: null, ownerName: ownerRow[0]?.name ?? null, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString(), deletedAt: null });
  } catch (err) {
    req.log.error({ err }, "Error creating vulnerability");
    return res.status(400).json({ error: "Invalid request" });
  }
});

router.post("/vulnerabilities/:id/restore", async (req: Request, res: Response) => {
  try {
    const id = parseIdParam(req);
    const [item] = await db.update(vulnerabilitiesTable)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(eq(vulnerabilitiesTable.id, id))
      .returning();
    if (!item) return res.status(404).json({ error: "Not found" });
    await db.insert(auditLogsTable).values({ action: "RESTORE", entityType: "Vulnerability", entityId: item.id, entityName: item.title, userName: "System" });
    return res.json({ ...item, applicationName: null, ownerName: null, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString(), deletedAt: null });
  } catch (err) {
    req.log.error({ err }, "Error restoring vulnerability");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/vulnerabilities/:id", async (req: Request, res: Response) => {
  try {
    const id = parseIdParam(req);
    const body = UpdateVulnerabilityBody.parse(req.body);
    const [item] = await db.update(vulnerabilitiesTable).set({ ...body, updatedAt: new Date() }).where(eq(vulnerabilitiesTable.id, id)).returning();
    if (!item) return res.status(404).json({ error: "Not found" });
    const ownerRow = item.ownerId ? await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, item.ownerId)).limit(1) : [];
    return res.json({ ...item, applicationName: null, ownerName: ownerRow[0]?.name ?? null, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString(), deletedAt: item.deletedAt ? item.deletedAt.toISOString() : null });
  } catch (err) {
    req.log.error({ err }, "Error updating vulnerability");
    return res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/vulnerabilities/:id", async (req: Request, res: Response) => {
  try {
    const id = parseIdParam(req);
    const [item] = await db.update(vulnerabilitiesTable)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(vulnerabilitiesTable.id, id), isNull(vulnerabilitiesTable.deletedAt)))
      .returning();
    if (!item) return res.status(404).json({ error: "Not found" });
    await db.insert(auditLogsTable).values({ action: "DELETE", entityType: "Vulnerability", entityId: item.id, entityName: item.title, userName: "System" });
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting vulnerability");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
