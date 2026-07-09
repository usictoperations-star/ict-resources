import { Router } from "express";
import type { Request, Response } from "express";
import { parseIdParam } from "../lib/params";
import { db } from "@workspace/db";
import { domainsTable, auditLogsTable, usersTable } from "@workspace/db";
import { CreateDomainBody, UpdateDomainBody } from "@workspace/api-zod";
import { eq, desc } from "drizzle-orm";

async function resolveOwnerName(ownerId: number | null | undefined): Promise<string | null> {
  if (!ownerId) return null;
  const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, ownerId));
  return user?.name ?? null;
}

const router = Router();

router.get("/expiring", async (req: Request, res: Response) => {
  try {
    const all = await db
      .select({ domain: domainsTable, ownerName: usersTable.name })
      .from(domainsTable)
      .leftJoin(usersTable, eq(domainsTable.ownerId, usersTable.id));
    const now = new Date();
    const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const expiring = all.filter(({ domain: d }) => {
      const expiry = d.sslExpiry || d.registrationExpiry;
      if (!expiry) return false;
      const date = new Date(expiry);
      return date >= now && date <= in90Days;
    });
    return res.json(expiring.map(({ domain: d, ownerName }) => ({ ...d, ownerName: ownerName ?? null, createdAt: d.createdAt.toISOString(), updatedAt: d.updatedAt.toISOString() })));
  } catch (err) {
    req.log.error({ err }, "Error fetching expiring domains");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/", async (req: Request, res: Response) => {
  try {
    const results = await db
      .select({ domain: domainsTable, ownerName: usersTable.name })
      .from(domainsTable)
      .leftJoin(usersTable, eq(domainsTable.ownerId, usersTable.id));
    return res.json(results.map(({ domain: d, ownerName }) => ({ ...d, ownerName: ownerName ?? null, createdAt: d.createdAt.toISOString(), updatedAt: d.updatedAt.toISOString() })));
  } catch (err) {
    req.log.error({ err }, "Error listing domains");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const body = CreateDomainBody.parse(req.body);
    const [item] = await db.insert(domainsTable).values(body).returning();
    const ownerName = await resolveOwnerName(item.ownerId);
    await db.insert(auditLogsTable).values({ action: "CREATE", entityType: "Domain", entityId: item.id, entityName: item.name, userName: "System" });
    return res.status(201).json({ ...item, ownerName, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Error creating domain");
    return res.status(400).json({ error: "Invalid request" });
  }
});

router.get("/:id/history", async (req: Request, res: Response) => {
  try {
    const id = parseIdParam(req);
    const entries = await db
      .select()
      .from(auditLogsTable)
      .where(eq(auditLogsTable.entityId, id))
      .orderBy(desc(auditLogsTable.createdAt));
    const domainEntries = entries.filter(e => e.entityType === "Domain");
    return res.json(
      domainEntries.map(e => ({
        id: e.id,
        action: e.action,
        entityName: e.entityName,
        userName: e.userName,
        changes: e.changes,
        createdAt: e.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Error fetching domain history");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseIdParam(req);
    const [result] = await db
      .select({ domain: domainsTable, ownerName: usersTable.name })
      .from(domainsTable)
      .leftJoin(usersTable, eq(domainsTable.ownerId, usersTable.id))
      .where(eq(domainsTable.id, id));
    if (!result) return res.status(404).json({ error: "Not found" });
    return res.json({ ...result.domain, ownerName: result.ownerName ?? null, createdAt: result.domain.createdAt.toISOString(), updatedAt: result.domain.updatedAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Error fetching domain");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseIdParam(req);
    const body = UpdateDomainBody.parse(req.body);
    const [item] = await db.update(domainsTable).set({ ...body, updatedAt: new Date() }).where(eq(domainsTable.id, id)).returning();
    if (!item) return res.status(404).json({ error: "Not found" });
    const ownerName = await resolveOwnerName(item.ownerId);
    return res.json({ ...item, ownerName, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Error updating domain");
    return res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseIdParam(req);
    const [item] = await db.delete(domainsTable).where(eq(domainsTable.id, id)).returning();
    if (!item) return res.status(404).json({ error: "Not found" });
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting domain");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
