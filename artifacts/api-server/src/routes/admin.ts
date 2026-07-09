import { Router } from "express";
import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { parsePagination } from "../lib/params";
import { db } from "@workspace/db";
import { usersTable, auditLogsTable, applicationsTable, databasesTable, infrastructureTable, domainsTable, repositoriesTable, releasesTable, vulnerabilitiesTable, softwareTable, documentsTable } from "@workspace/db";
import { CreateUserBody, UpdateUserBody } from "@workspace/api-zod";
import { eq, isNull, isNotNull, count, and } from "drizzle-orm";
import { logAudit } from "../lib/audit";
import { sql } from "drizzle-orm";
import { sendError } from "../lib/errors";
const router = Router();

router.get("/deleted-records", async (req: Request, res: Response) => {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const [applications, infrastructure, databases, domains, repositories, releases, vulnerabilities, software, documents] = await Promise.all([
      db.select().from(applicationsTable).where(isNotNull(applicationsTable.deletedAt)),
      db.select().from(infrastructureTable).where(isNotNull(infrastructureTable.deletedAt)),
      db.select().from(databasesTable).where(isNotNull(databasesTable.deletedAt)),
      db.select().from(domainsTable).where(isNotNull(domainsTable.deletedAt)),
      db.select().from(repositoriesTable).where(isNotNull(repositoriesTable.deletedAt)),
      db.select().from(releasesTable).where(isNotNull(releasesTable.deletedAt)),
      db.select().from(vulnerabilitiesTable).where(isNotNull(vulnerabilitiesTable.deletedAt)),
      db.select().from(softwareTable).where(isNotNull(softwareTable.deletedAt)),
      db.select().from(documentsTable).where(isNotNull(documentsTable.deletedAt)),
    ]);

    const within30Days = (deletedAt: Date | null) => deletedAt && deletedAt >= cutoff;

    return res.json({
      applications: applications.filter(a => within30Days(a.deletedAt)).map(a => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
        deletedAt: a.deletedAt ? a.deletedAt.toISOString() : null,
      })),
      infrastructure: infrastructure.filter(i => within30Days(i.deletedAt)).map(i => ({
        ...i,
        createdAt: i.createdAt.toISOString(),
        updatedAt: i.updatedAt.toISOString(),
        deletedAt: i.deletedAt ? i.deletedAt.toISOString() : null,
      })),
      databases: databases.filter(d => within30Days(d.deletedAt)).map(d => ({
        ...d,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
        deletedAt: d.deletedAt ? d.deletedAt.toISOString() : null,
      })),
      domains: domains.filter(d => within30Days(d.deletedAt)).map(d => ({
        ...d,
        ownerName: null,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
        deletedAt: d.deletedAt ? d.deletedAt.toISOString() : null,
      })),
      repositories: repositories.filter(r => within30Days(r.deletedAt)).map(r => ({
        ...r,
        ownerName: null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        deletedAt: r.deletedAt ? r.deletedAt.toISOString() : null,
      })),
      releases: releases.filter(r => within30Days(r.deletedAt)).map(r => ({
        ...r,
        applicationName: null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        deletedAt: r.deletedAt ? r.deletedAt.toISOString() : null,
      })),
      vulnerabilities: vulnerabilities.filter(v => within30Days(v.deletedAt)).map(v => ({
        ...v,
        applicationName: null,
        ownerName: null,
        createdAt: v.createdAt.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
        deletedAt: v.deletedAt ? v.deletedAt.toISOString() : null,
      })),
      software: software.filter(s => within30Days(s.deletedAt)).map(s => ({
        ...s,
        ownerName: null,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
        deletedAt: s.deletedAt ? s.deletedAt.toISOString() : null,
      })),
      documents: documents.filter(d => within30Days(d.deletedAt)).map(d => ({
        ...d,
        applicationName: null,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
        deletedAt: d.deletedAt ? d.deletedAt.toISOString() : null,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Error listing deleted records");
    return sendError(res, 500, "Internal server error");
  }
});

router.get("/users", async (req: Request, res: Response) => {
  try {
    const results = await db.select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      role: usersTable.role,
      phone: usersTable.phone,
      department: usersTable.department,
      status: usersTable.status,
      lastLoginAt: usersTable.lastLoginAt,
      createdAt: usersTable.createdAt,
      hasPassword: sql<boolean>`(${usersTable.passwordHash} IS NOT NULL)`,
    }).from(usersTable);
    return res.json(results.map(u => ({ ...u, createdAt: u.createdAt.toISOString() })));
  } catch (err) {
    req.log.error({ err }, "Error listing users");
    return sendError(res, 500, "Internal server error");
  }
});

router.post("/users", async (req: Request, res: Response) => {
  try {
    const body = CreateUserBody.parse(req.body);
    const { password, ...rest } = body as typeof body & { password?: string };

    if (!password) {
      return sendError(res, 400, "Password is required when creating a user");
    }

    const values: typeof usersTable.$inferInsert = {
      ...rest,
      passwordHash: await bcrypt.hash(password, 12),
    };

    const [item] = await db.insert(usersTable).values(values).returning();
    await logAudit(req, "CREATE", "User", item.id, item.name);
    return res.status(201).json({ ...item, createdAt: item.createdAt.toISOString(), hasPassword: !!item.passwordHash });
  } catch (err) {
    req.log.error({ err }, "Error creating user");
    return sendError(res, 400, "Invalid request");
  }
});

router.patch("/users/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const body = UpdateUserBody.parse(req.body);
    const { password, ...rest } = body as typeof body & { password?: string };

    const values: Partial<typeof usersTable.$inferInsert> = { ...rest };
    if (password) {
      values.passwordHash = await bcrypt.hash(password, 12);
    }

    const [item] = await db.update(usersTable).set(values).where(eq(usersTable.id, id)).returning();
    if (!item) return sendError(res, 404, "Not found");
    await logAudit(req, "UPDATE", "User", item.id, item.name);
    return res.json({ ...item, createdAt: item.createdAt.toISOString(), hasPassword: !!item.passwordHash });
  } catch (err) {
    req.log.error({ err }, "Error updating user");
    return sendError(res, 400, "Invalid request");
  }
});

router.delete("/users/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const [item] = await db.delete(usersTable).where(eq(usersTable.id, id)).returning();
    if (!item) return sendError(res, 404, "Not found");
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting user");
    return sendError(res, 500, "Internal server error");
  }
});

router.get("/audit-logs", async (req: Request, res: Response) => {
  try {
    const { limit, offset } = parsePagination(req);
    const { userId, action, entityType } = req.query as Record<string, string>;
    const conditions = [];
    if (userId) conditions.push(eq(auditLogsTable.userId, parseInt(userId)));
    if (action) conditions.push(eq(auditLogsTable.action, action));
    if (entityType) conditions.push(eq(auditLogsTable.entityType, entityType));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [[{ total }], logs] = await Promise.all([
      db.select({ total: count() }).from(auditLogsTable).where(where),
      db.select().from(auditLogsTable)
        .where(where)
        .orderBy(sql`${auditLogsTable.createdAt} DESC`)
        .limit(limit)
        .offset(offset),
    ]);
    return res.json({ data: logs.map(l => ({ ...l, createdAt: l.createdAt.toISOString() })), total: Number(total) });
  } catch (err) {
    req.log.error({ err }, "Error listing audit logs");
    return sendError(res, 500, "Internal server error");
  }
});

export default router;
