/**
 * Playwright globalTeardown — runs once after every test suite.
 *
 * Deletes any E2E test records that were left behind by failed test runs.
 * Uses the saved auth session to authenticate, then calls the API to delete
 * orphaned rows whose name/title matches a known E2E test prefix.
 *
 * This is intentionally lenient: errors during cleanup are logged but never
 * fail the test run, since cleanup is best-effort housekeeping.
 */
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface ListResponse {
  data?: Array<{ id: number; name?: string; title?: string }>;
}

type Item = { id: number; name?: string; title?: string };

async function teardown() {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:80";
  const authStatePath = path.join(__dirname, ".auth/session.json");

  let cookieHeader = "";
  try {
    const raw = await fs.readFile(authStatePath, "utf-8");
    const state = JSON.parse(raw) as {
      cookies?: Array<{ name: string; value: string }>;
    };
    cookieHeader = (state.cookies ?? [])
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
  } catch {
    console.warn("[teardown] No auth session found — skipping E2E cleanup.");
    return;
  }

  if (!cookieHeader) {
    console.warn("[teardown] Empty auth session — skipping E2E cleanup.");
    return;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Cookie: cookieHeader,
  };

  async function listAll(endpoint: string): Promise<Item[]> {
    try {
      const res = await fetch(`${baseURL}${endpoint}?limit=500&offset=0`, {
        headers,
      });
      if (!res.ok) return [];
      const body = (await res.json()) as ListResponse | Item[];
      if (Array.isArray(body)) return body;
      return body.data ?? [];
    } catch {
      return [];
    }
  }

  async function deleteMatching(
    endpoint: string,
    field: "name" | "title",
    pattern: RegExp
  ): Promise<number> {
    const items = await listAll(endpoint);
    const toDelete = items.filter((item) => pattern.test(item[field] ?? ""));
    let deleted = 0;
    for (const item of toDelete) {
      try {
        const res = await fetch(`${baseURL}${endpoint}/${item.id}`, {
          method: "DELETE",
          headers,
        });
        if (res.ok) deleted++;
      } catch {
        // best-effort
      }
    }
    if (deleted > 0) {
      console.log(`[teardown] Deleted ${deleted} orphaned record(s) from ${endpoint}`);
    }
    return deleted;
  }

  // ── Applications: find IDs first so we can clean up linked releases ─────────
  const allApps = await listAll("/api/applications");
  const e2eApps = allApps.filter((a) => /^E2E /.test(a.name ?? ""));

  if (e2eApps.length > 0) {
    const e2eAppIds = new Set(e2eApps.map((a) => a.id));

    // Delete releases whose applicationId points to an E2E test app
    const allReleases = await listAll("/api/releases");
    const e2eReleases = (
      allReleases as Array<{ id: number; applicationId?: number }>
    ).filter((r) => r.applicationId != null && e2eAppIds.has(r.applicationId));

    let relDeleted = 0;
    for (const r of e2eReleases) {
      try {
        const res = await fetch(`${baseURL}/api/releases/${r.id}`, {
          method: "DELETE",
          headers,
        });
        if (res.ok) relDeleted++;
      } catch {
        // best-effort
      }
    }
    if (relDeleted > 0) {
      console.log(
        `[teardown] Deleted ${relDeleted} orphaned release(s) from /api/releases`
      );
    }

    // Now delete the E2E applications
    let appDeleted = 0;
    for (const app of e2eApps) {
      try {
        const res = await fetch(`${baseURL}/api/applications/${app.id}`, {
          method: "DELETE",
          headers,
        });
        if (res.ok) appDeleted++;
      } catch {
        // best-effort
      }
    }
    if (appDeleted > 0) {
      console.log(
        `[teardown] Deleted ${appDeleted} orphaned application(s) from /api/applications`
      );
    }
  }

  // ── Remaining tables ─────────────────────────────────────────────────────────
  await deleteMatching("/api/documentation", "title", /^E2E Doc /);
  await deleteMatching("/api/software", "name", /^E2E Lib /);
  await deleteMatching("/api/domains", "name", /^e2e-/);
  await deleteMatching("/api/repositories", "name", /^e2e-repo-/);
  await deleteMatching("/api/infrastructure", "name", /^e2e-server-/);
  await deleteMatching("/api/databases", "name", /^e2e-db-/);
  await deleteMatching("/api/users", "name", /^E2E User /);
  await deleteMatching("/api/security/vulnerabilities", "title", /^E2E Vuln /);
}

export default async function globalTeardown() {
  await teardown().catch((err) => {
    console.error("[teardown] Unexpected error during E2E cleanup:", err);
  });
}
