import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { documentsTable, applicationsTable, auditLogsTable } from "@workspace/db";
import { CreateDocumentBody, UpdateDocumentBody } from "@workspace/api-zod";
import { eq, and } from "drizzle-orm";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const { type, applicationId } = req.query as Record<string, string>;
    const conditions = [];
    if (type) conditions.push(eq(documentsTable.type, type));
    if (applicationId) conditions.push(eq(documentsTable.applicationId, parseInt(applicationId)));

    const docs = conditions.length
      ? await db.select().from(documentsTable).where(and(...conditions))
      : await db.select().from(documentsTable);

    const apps = await db.select().from(applicationsTable);
    const appMap = new Map(apps.map(a => [a.id, a.name]));

    return res.json(docs.map(d => ({
      ...d,
      applicationName: d.applicationId ? appMap.get(d.applicationId) ?? null : null,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Error listing documents");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const body = CreateDocumentBody.parse(req.body);
    const [item] = await db.insert(documentsTable).values(body).returning();
    await db.insert(auditLogsTable).values({ action: "CREATE", entityType: "Document", entityId: item.id, entityName: item.title, userName: "System" });
    return res.status(201).json({ ...item, applicationName: null, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Error creating document");
    return res.status(400).json({ error: "Invalid request" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [item] = await db.select().from(documentsTable).where(eq(documentsTable.id, id));
    if (!item) return res.status(404).json({ error: "Not found" });
    const appName = item.applicationId ? (await db.select().from(applicationsTable).where(eq(applicationsTable.id, item.applicationId)))[0]?.name ?? null : null;
    return res.json({ ...item, applicationName: appName, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Error fetching document");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const body = UpdateDocumentBody.parse(req.body);
    const [item] = await db.update(documentsTable).set({ ...body, updatedAt: new Date() }).where(eq(documentsTable.id, id)).returning();
    if (!item) return res.status(404).json({ error: "Not found" });
    return res.json({ ...item, applicationName: null, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Error updating document");
    return res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [item] = await db.delete(documentsTable).where(eq(documentsTable.id, id)).returning();
    if (!item) return res.status(404).json({ error: "Not found" });
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting document");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
