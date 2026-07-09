import { Router } from "express";
import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, auditLogsTable, applicationsTable, databasesTable, infrastructureTable, domainsTable, repositoriesTable, releasesTable } from "@workspace/db";
import { CreateUserBody, UpdateUserBody } from "@workspace/api-zod";
import { eq, isNull, isNotNull } from "drizzle-orm";
import { sql } from "drizzle-orm";
const router = Router();

router.get("/deleted-records", async (req: Request, res: Response) => {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const [applications, infrastructure, databases, domains, repositories, releases] = await Promise.all([
      db.select().from(applicationsTable).where(isNotNull(applicationsTable.deletedAt)),
      db.select().from(infrastructureTable).where(isNotNull(infrastructureTable.deletedAt)),
      db.select().from(databasesTable).where(isNotNull(databasesTable.deletedAt)),
      db.select().from(domainsTable).where(isNotNull(domainsTable.deletedAt)),
      db.select().from(repositoriesTable).where(isNotNull(repositoriesTable.deletedAt)),
      db.select().from(releasesTable).where(isNotNull(releasesTable.deletedAt)),
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
    });
  } catch (err) {
    req.log.error({ err }, "Error listing deleted records");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/users", async (req: Request, res: Response) => {
  try {
    const results = await db.select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      roles: usersTable.roles,
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
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/users", async (req: Request, res: Response) => {
  try {
    const body = CreateUserBody.parse(req.body);
    const { password, ...rest } = body as typeof body & { password?: string };

    const values: typeof usersTable.$inferInsert = { ...rest };
    if (password) {
      values.passwordHash = await bcrypt.hash(password, 12);
    }

    const [item] = await db.insert(usersTable).values(values).returning();
    await db.insert(auditLogsTable).values({ action: "CREATE", entityType: "User", entityId: item.id, entityName: item.name, userName: "System" });
    return res.status(201).json({ ...item, createdAt: item.createdAt.toISOString(), hasPassword: !!item.passwordHash });
  } catch (err) {
    req.log.error({ err }, "Error creating user");
    return res.status(400).json({ error: "Invalid request" });
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
    if (!item) return res.status(404).json({ error: "Not found" });
    await db.insert(auditLogsTable).values({ action: "UPDATE", entityType: "User", entityId: item.id, entityName: item.name, userName: "System" });
    return res.json({ ...item, createdAt: item.createdAt.toISOString(), hasPassword: !!item.passwordHash });
  } catch (err) {
    req.log.error({ err }, "Error updating user");
    return res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/users/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const [item] = await db.delete(usersTable).where(eq(usersTable.id, id)).returning();
    if (!item) return res.status(404).json({ error: "Not found" });
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting user");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/audit-logs", async (req: Request, res: Response) => {
  try {
    const { limit } = req.query as Record<string, string>;
    const maxLimit = Math.min(parseInt(limit ?? "50"), 200);
    const logs = await db.select().from(auditLogsTable)
      .orderBy(sql`${auditLogsTable.createdAt} DESC`)
      .limit(maxLimit);
    return res.json(logs.map(l => ({ ...l, createdAt: l.createdAt.toISOString() })));
  } catch (err) {
    req.log.error({ err }, "Error listing audit logs");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
