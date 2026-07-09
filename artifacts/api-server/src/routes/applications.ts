import { Router } from "express";
import type { Request, Response } from "express";
import { parseIdParam, parsePagination } from "../lib/params";
import { db } from "@workspace/db";
import { applicationsTable, releasesTable, documentsTable, vulnerabilitiesTable, softwareTable, repositoriesTable, domainsTable, usersTable } from "@workspace/db";
import { CreateApplicationBody, UpdateApplicationBody } from "@workspace/api-zod";
import { eq, ilike, and, count, isNull, isNotNull, gte } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { logAudit } from "../lib/audit";
import { sendError } from "../lib/errors";

const router = Router();

async function resolveOwnerName(ownerId: number | null | undefined): Promise<string | null> {
  if (!ownerId) return null;
  const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, ownerId));
  return user?.name ?? null;
}

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
    return sendError(res, 500, "Internal server error");
  }
});

router.get("/", async (req: Request, res: Response) => {
  try {
    const { status, category, environment, search } = req.query as Record<string, string>;
    const { limit, offset } = parsePagination(req);
    const conditions = [isNull(applicationsTable.deletedAt)];
    if (status) conditions.push(eq(applicationsTable.status, status));
    if (category) conditions.push(eq(applicationsTable.category, category));
    if (environment) conditions.push(eq(applicationsTable.environment, environment));
    if (search) conditions.push(ilike(applicationsTable.name, `%${search}%`));

    const [[{ total }], results] = await Promise.all([
      db.select({ total: count() }).from(applicationsTable).where(and(...conditions)),
      db.select({ app: applicationsTable, ownerName: usersTable.name })
        .from(applicationsTable)
        .leftJoin(usersTable, eq(applicationsTable.ownerId, usersTable.id))
        .where(and(...conditions))
        .limit(limit)
        .offset(offset),
    ]);

    return res.json({
      data: results.map(({ app: a, ownerName }) => ({
        ...a,
        ownerName: ownerName ?? null,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
        deletedAt: a.deletedAt ? a.deletedAt.toISOString() : null,
      })),
      total: Number(total),
    });
  } catch (err) {
    req.log.error({ err }, "Error listing applications");
    return sendError(res, 500, "Internal server error");
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const body = CreateApplicationBody.parse(req.body);
    const [app] = await db.insert(applicationsTable).values(body).returning();
    const ownerName = await resolveOwnerName(app.ownerId);
    await logAudit(req, "CREATE", "Application", app.id, app.name);
    return res.status(201).json({ ...app, ownerName, createdAt: app.createdAt.toISOString(), updatedAt: app.updatedAt.toISOString(), deletedAt: null });
  } catch (err) {
    req.log.error({ err }, "Error creating application");
    return sendError(res, 400, "Invalid request");
  }
});

router.post("/:id/restore", async (req: Request, res: Response) => {
  try {
    const id = parseIdParam(req);
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [app] = await db.update(applicationsTable)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(and(eq(applicationsTable.id, id), isNotNull(applicationsTable.deletedAt), gte(applicationsTable.deletedAt, cutoff)))
      .returning();
    if (!app) return sendError(res, 404, "Not found or outside the 30-day restore window");
    const ownerName = await resolveOwnerName(app.ownerId);
    await logAudit(req, "RESTORE", "Application", app.id, app.name);
    return res.json({ ...app, ownerName, createdAt: app.createdAt.toISOString(), updatedAt: app.updatedAt.toISOString(), deletedAt: null });
  } catch (err) {
    req.log.error({ err }, "Error restoring application");
    return sendError(res, 500, "Internal server error");
  }
});

router.get("/:id/dependents", async (req: Request, res: Response) => {
  try {
    const id = parseIdParam(req);
    const [app] = await db.select({ id: applicationsTable.id }).from(applicationsTable).where(eq(applicationsTable.id, id));
    if (!app) return sendError(res, 404, "Not found");

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
    return sendError(res, 500, "Internal server error");
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseIdParam(req);
    const [result] = await db
      .select({ app: applicationsTable, ownerName: usersTable.name })
      .from(applicationsTable)
      .leftJoin(usersTable, eq(applicationsTable.ownerId, usersTable.id))
      .where(and(eq(applicationsTable.id, id), isNull(applicationsTable.deletedAt)));
    if (!result) return sendError(res, 404, "Not found");
    const { app, ownerName } = result;
    return res.json({ ...app, ownerName: ownerName ?? null, createdAt: app.createdAt.toISOString(), updatedAt: app.updatedAt.toISOString(), deletedAt: app.deletedAt ? app.deletedAt.toISOString() : null });
  } catch (err) {
    req.log.error({ err }, "Error fetching application");
    return sendError(res, 500, "Internal server error");
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseIdParam(req);
    const body = UpdateApplicationBody.parse(req.body);
    const [app] = await db.update(applicationsTable)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(applicationsTable.id, id), isNull(applicationsTable.deletedAt)))
      .returning();
    if (!app) return sendError(res, 404, "Not found");
    const ownerName = await resolveOwnerName(app.ownerId);
    await logAudit(req, "UPDATE", "Application", app.id, app.name);
    return res.json({ ...app, ownerName, createdAt: app.createdAt.toISOString(), updatedAt: app.updatedAt.toISOString(), deletedAt: null });
  } catch (err) {
    req.log.error({ err }, "Error updating application");
    return sendError(res, 400, "Invalid request");
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseIdParam(req);
    const cascade = req.query.cascade === "true";
    const reassignToRaw = req.query.reassignTo;
    const reassignTo = reassignToRaw ? parseInt(reassignToRaw as string, 10) : null;

    if (cascade && reassignTo !== null) {
      return sendError(res, 400, "Cannot specify both cascade and reassignTo");
    }

    const [app] = await db.select({ id: applicationsTable.id, name: applicationsTable.name })
      .from(applicationsTable)
      .where(and(eq(applicationsTable.id, id), isNull(applicationsTable.deletedAt)));
    if (!app) return sendError(res, 404, "Not found");

    if (reassignTo !== null && isNaN(reassignTo)) {
      return sendError(res, 400, "Invalid reassignTo value");
    }

    if (reassignTo !== null && reassignTo === id) {
      return sendError(res, 400, "Cannot reassign linked records to the same application being deleted");
    }

    const [[relCount], [docCount], [vulnCount], [swCount], [repoCount], [domCount]] = await Promise.all([
      db.select({ n: count() }).from(releasesTable).where(eq(releasesTable.applicationId, id)),
      db.select({ n: count() }).from(documentsTable).where(eq(documentsTable.applicationId, id)),
      db.select({ n: count() }).from(vulnerabilitiesTable).where(eq(vulnerabilitiesTable.applicationId, id)),
      db.select({ n: count() }).from(softwareTable).where(eq(softwareTable.applicationId, id)),
      db.select({ n: count() }).from(repositoriesTable).where(eq(repositoriesTable.applicationId, id)),
      db.select({ n: count() }).from(domainsTable).where(eq(domainsTable.applicationId, id)),
    ]);
    const dependentTotal = Number(relCount.n) + Number(docCount.n) + Number(vulnCount.n) + Number(swCount.n) + Number(repoCount.n) + Number(domCount.n);

    if (dependentTotal > 0 && !cascade && reassignTo === null) {
      return res.status(409).json({
        error: "This application has linked records. Provide cascade=true to delete them or reassignTo=<id> to reassign them.",
        dependentTotal,
      });
    }

    if (reassignTo !== null) {
      const [targetApp] = await db.select({ id: applicationsTable.id })
        .from(applicationsTable)
        .where(and(eq(applicationsTable.id, reassignTo), isNull(applicationsTable.deletedAt)));
      if (!targetApp) {
        return sendError(res, 400, "Target application not found or has been deleted");
      }
      await Promise.all([
        db.update(releasesTable).set({ applicationId: reassignTo }).where(eq(releasesTable.applicationId, id)),
        db.update(documentsTable).set({ applicationId: reassignTo }).where(eq(documentsTable.applicationId, id)),
        db.update(vulnerabilitiesTable).set({ applicationId: reassignTo }).where(eq(vulnerabilitiesTable.applicationId, id)),
        db.update(softwareTable).set({ applicationId: reassignTo }).where(eq(softwareTable.applicationId, id)),
        db.update(repositoriesTable).set({ applicationId: reassignTo }).where(eq(repositoriesTable.applicationId, id)),
        db.update(domainsTable).set({ applicationId: reassignTo }).where(eq(domainsTable.applicationId, id)),
      ]);
    } else if (cascade) {
      await Promise.all([
        db.delete(releasesTable).where(eq(releasesTable.applicationId, id)),
        db.delete(documentsTable).where(eq(documentsTable.applicationId, id)),
        db.delete(vulnerabilitiesTable).where(eq(vulnerabilitiesTable.applicationId, id)),
        db.delete(softwareTable).where(eq(softwareTable.applicationId, id)),
        db.delete(repositoriesTable).where(eq(repositoriesTable.applicationId, id)),
        db.delete(domainsTable).where(eq(domainsTable.applicationId, id)),
      ]);
    }

    await db.update(applicationsTable)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(applicationsTable.id, id));

    await logAudit(req, "DELETE", "Application", app.id, app.name);
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting application");
    return sendError(res, 500, "Internal server error");
  }
});

export default router;
