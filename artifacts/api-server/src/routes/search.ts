import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import {
  applicationsTable, infrastructureTable, databasesTable,
  domainsTable, repositoriesTable, documentsTable
} from "@workspace/db";
import { ilike, or, and, isNull } from "drizzle-orm";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) ?? "";
    if (!q.trim()) return res.json({ applications: [], infrastructure: [], databases: [], domains: [], repositories: [], documents: [] });

    const pattern = `%${q}%`;

    const [apps, infra, dbs, domains, repos, docs] = await Promise.all([
      db.select().from(applicationsTable).where(and(isNull(applicationsTable.deletedAt), or(ilike(applicationsTable.name, pattern), ilike(applicationsTable.description, pattern)))).limit(10),
      db.select().from(infrastructureTable).where(and(isNull(infrastructureTable.deletedAt), or(ilike(infrastructureTable.name, pattern), ilike(infrastructureTable.type, pattern)))).limit(10),
      db.select().from(databasesTable).where(and(isNull(databasesTable.deletedAt), or(ilike(databasesTable.name, pattern), ilike(databasesTable.type, pattern)))).limit(10),
      db.select().from(domainsTable).where(ilike(domainsTable.name, pattern)).limit(10),
      db.select().from(repositoriesTable).where(or(ilike(repositoriesTable.name, pattern), ilike(repositoriesTable.url, pattern))).limit(10),
      db.select().from(documentsTable).where(or(ilike(documentsTable.title, pattern), ilike(documentsTable.content, pattern))).limit(10),
    ]);

    const fmt = (r: { createdAt: Date; updatedAt: Date; [k: string]: unknown }) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    });

    return res.json({
      applications: apps.map(fmt),
      infrastructure: infra.map(fmt),
      databases: dbs.map(fmt),
      domains: domains.map(fmt),
      repositories: repos.map(fmt),
      documents: docs.map(a => ({ ...a, applicationName: null, createdAt: a.createdAt.toISOString(), updatedAt: a.updatedAt.toISOString() })),
    });
  } catch (err) {
    req.log.error({ err }, "Error searching");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
