import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { usersTable, auditLogsTable, applicationsTable, databasesTable, infrastructureTable } from "@workspace/db";
import { CreateUserBody, UpdateUserBody } from "@workspace/api-zod";
import { eq, isNull, isNotNull, gte } from "drizzle-orm";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/deleted-records", async (req: Request, res: Response) => {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const [applications, infrastructure, databases] = await Promise.all([
      db.select().from(applicationsTable).where(isNotNull(applicationsTable.deletedAt)),
      db.select().from(infrastructureTable).where(isNotNull(infrastructureTable.deletedAt)),
      db.select().from(databasesTable).where(isNotNull(databasesTable.deletedAt)),
    ]);

    const fmtApp = (a: typeof applicationsTable.$inferSelect) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
      deletedAt: a.deletedAt ? a.deletedAt.toISOString() : null,
    });
    const fmtInfra = (i: typeof infrastructureTable.$inferSelect) => ({
      ...i,
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
      deletedAt: i.deletedAt ? i.deletedAt.toISOString() : null,
    });
    const fmtDb = (d: typeof databasesTable.$inferSelect) => ({
      ...d,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      deletedAt: d.deletedAt ? d.deletedAt.toISOString() : null,
    });

    const within30Days = (deletedAt: Date | null) => deletedAt && deletedAt >= cutoff;

    return res.json({
      applications: applications.filter(a => within30Days(a.deletedAt)).map(fmtApp),
      infrastructure: infrastructure.filter(i => within30Days(i.deletedAt)).map(fmtInfra),
      databases: databases.filter(d => within30Days(d.deletedAt)).map(fmtDb),
    });
  } catch (err) {
    req.log.error({ err }, "Error listing deleted records");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/users", async (req: Request, res: Response) => {
  try {
    const results = await db.select().from(usersTable);
    return res.json(results.map(u => ({ ...u, createdAt: u.createdAt.toISOString() })));
  } catch (err) {
    req.log.error({ err }, "Error listing users");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/users", async (req: Request, res: Response) => {
  try {
    const body = CreateUserBody.parse(req.body);
    const [item] = await db.insert(usersTable).values(body).returning();
    await db.insert(auditLogsTable).values({ action: "CREATE", entityType: "User", entityId: item.id, entityName: item.name, userName: "System" });
    return res.status(201).json({ ...item, createdAt: item.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Error creating user");
    return res.status(400).json({ error: "Invalid request" });
  }
});

router.patch("/users/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const body = UpdateUserBody.parse(req.body);
    const [item] = await db.update(usersTable).set(body).where(eq(usersTable.id, id)).returning();
    if (!item) return res.status(404).json({ error: "Not found" });
    return res.json({ ...item, createdAt: item.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Error updating user");
    return res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/users/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
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
