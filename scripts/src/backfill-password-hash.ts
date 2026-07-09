/**
 * backfill-password-hash.ts
 *
 * One-time migration helper: sets a random bcrypt placeholder hash on any
 * users row where password_hash IS NULL, before the NOT NULL constraint is
 * enforced by `drizzle-kit push`.
 *
 * Run BEFORE applying the schema push that makes password_hash NOT NULL:
 *   pnpm --filter @workspace/scripts run backfill-password-hash
 */
import { pool } from "@workspace/db";
import bcrypt from "bcryptjs";

async function backfillPasswordHash() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ id: number; email: string }>(
      "SELECT id, email FROM users WHERE password_hash IS NULL"
    );

    if (rows.length === 0) {
      console.log("No users with null password_hash found — nothing to backfill.");
      return;
    }

    console.log(`Found ${rows.length} user(s) with null password_hash. Backfilling...`);

    for (const user of rows) {
      const placeholder = await bcrypt.hash(
        `reset-required-${user.id}-${Date.now()}`,
        12,
      );
      await client.query(
        "UPDATE users SET password_hash = $1 WHERE id = $2",
        [placeholder, user.id],
      );
      console.log(`  Set placeholder hash for user #${user.id} (${user.email})`);
    }

    console.log("Backfill complete. Affected users must reset their password via Administration > Users.");
  } finally {
    client.release();
  }
}

backfillPasswordHash()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  });
