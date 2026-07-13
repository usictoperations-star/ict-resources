/**
 * One-time cleanup script: removes orphaned E2E test records from the dev database.
 *
 * Run with:
 *   pnpm --filter @workspace/scripts run cleanup-e2e-records
 *
 * Safe to run multiple times (idempotent). Only deletes rows whose name/title
 * starts with a known E2E test prefix — no real data is touched.
 */
import {
  db,
  applicationsTable,
  releasesTable,
  documentsTable,
  softwareTable,
  domainsTable,
  repositoriesTable,
  infrastructureTable,
  databasesTable,
  usersTable,
  vulnerabilitiesTable,
} from "@workspace/db";
import { like, inArray } from "drizzle-orm";

async function cleanupE2ERecords() {
  console.log("Starting E2E test record cleanup…\n");

  let total = 0;

  function tally(label: string, rowCount: number | undefined) {
    const n = rowCount ?? 0;
    total += n;
    if (n > 0) console.log(`  ✓ Deleted ${n} ${label}`);
  }

  // ── 1. Releases ────────────────────────────────────────────────────────────
  // Must be removed before their parent applications are deleted so we can
  // identify them by their applicationId FK (which becomes NULL on app delete).
  const e2eApps = await db
    .select({ id: applicationsTable.id })
    .from(applicationsTable)
    .where(like(applicationsTable.name, "E2E %"));

  if (e2eApps.length > 0) {
    const e2eAppIds = e2eApps.map((a) => a.id);
    const { rowCount: relCount } = await db
      .delete(releasesTable)
      .where(inArray(releasesTable.applicationId, e2eAppIds));
    tally("release(s)", relCount ?? 0);
  }

  // ── 2. Applications ─────────────────────────────────────────────────────────
  // Covers: "E2E App <suffix>", "E2E App Del <suffix>", "E2E App <suffix> Updated"
  {
    const { rowCount } = await db
      .delete(applicationsTable)
      .where(like(applicationsTable.name, "E2E %"));
    tally("application(s)", rowCount ?? 0);
  }

  // ── 3. Documents ────────────────────────────────────────────────────────────
  // Covers: "E2E Doc <suffix>", "E2E Doc <suffix> Updated"
  {
    const { rowCount } = await db
      .delete(documentsTable)
      .where(like(documentsTable.title, "E2E Doc %"));
    tally("document(s)", rowCount ?? 0);
  }

  // ── 4. Software ─────────────────────────────────────────────────────────────
  // Covers: "E2E Lib <suffix>", "E2E Lib <suffix> Updated"
  {
    const { rowCount } = await db
      .delete(softwareTable)
      .where(like(softwareTable.name, "E2E Lib %"));
    tally("software item(s)", rowCount ?? 0);
  }

  // ── 5. Domains ──────────────────────────────────────────────────────────────
  // Covers: "e2e-<suffix>.mk.gov", "e2e-<suffix>-up.mk.gov"
  {
    const { rowCount } = await db
      .delete(domainsTable)
      .where(like(domainsTable.name, "e2e-%"));
    tally("domain(s)", rowCount ?? 0);
  }

  // ── 6. Repositories ─────────────────────────────────────────────────────────
  // Covers: "e2e-repo-<suffix>", "e2e-repo-<suffix>-updated"
  {
    const { rowCount } = await db
      .delete(repositoriesTable)
      .where(like(repositoriesTable.name, "e2e-repo-%"));
    tally("repositor(ies)", rowCount ?? 0);
  }

  // ── 7. Infrastructure ───────────────────────────────────────────────────────
  // Covers: "e2e-server-<suffix>", "e2e-server-del-<suffix>"
  {
    const { rowCount } = await db
      .delete(infrastructureTable)
      .where(like(infrastructureTable.name, "e2e-server-%"));
    tally("infrastructure record(s)", rowCount ?? 0);
  }

  // ── 8. Databases ────────────────────────────────────────────────────────────
  // Covers: "e2e-db-<suffix>", "e2e-db-del-<suffix>"
  {
    const { rowCount } = await db
      .delete(databasesTable)
      .where(like(databasesTable.name, "e2e-db-%"));
    tally("database record(s)", rowCount ?? 0);
  }

  // ── 9. Users ────────────────────────────────────────────────────────────────
  // Covers: "E2E User <suffix>", "E2E User <suffix> Updated"
  // Uses name match (not email) to be precise and avoid false positives.
  {
    const { rowCount } = await db
      .delete(usersTable)
      .where(like(usersTable.name, "E2E User %"));
    tally("user(s)", rowCount ?? 0);
  }

  // ── 10. Vulnerabilities ─────────────────────────────────────────────────────
  // Covers: "E2E Vuln <suffix>", "E2E Vuln <suffix> Updated"
  {
    const { rowCount } = await db
      .delete(vulnerabilitiesTable)
      .where(like(vulnerabilitiesTable.title, "E2E Vuln %"));
    tally("vulnerability(ies)", rowCount ?? 0);
  }

  if (total === 0) {
    console.log("  Nothing to clean up — database is already tidy.");
  }

  console.log(`\nDone. ${total} total record(s) removed.`);
}

cleanupE2ERecords()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Cleanup failed:", err);
    process.exit(1);
  });
