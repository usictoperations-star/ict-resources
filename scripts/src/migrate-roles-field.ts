/**
 * Migration: users.roles text[] → users.role text
 *
 * Replaces the multi-value `roles` array column with a single `role` text
 * column. Existing users keep their primary role (roles[1] in Postgres
 * 1-based arrays, fallback to 'viewer'). This script is idempotent — safe
 * to run more than once.
 *
 * Run with: pnpm --filter @workspace/scripts run migrate-roles-field
 */

import { pool } from "@workspace/db";

async function migrateRolesField() {
  const client = await pool.connect();
  try {
    // Check whether the old `roles` column still exists
    const { rows: rolesCheck } = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'roles'
      ) AS exists`
    );
    const rolesExists = rolesCheck[0].exists;

    // Check whether the new `role` column already exists
    const { rows: roleCheck } = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'role'
      ) AS exists`
    );
    const roleExists = roleCheck[0].exists;

    if (!rolesExists && roleExists) {
      console.log("Migration already applied — users.role exists and users.roles is gone. Nothing to do.");
      return;
    }

    if (!rolesExists && !roleExists) {
      throw new Error("Neither 'roles' nor 'role' column exists on users table — unexpected schema state.");
    }

    // Add `role` column if it doesn't exist yet
    if (!roleExists) {
      await client.query(`ALTER TABLE users ADD COLUMN role text NOT NULL DEFAULT 'viewer'`);
      console.log("Added users.role column (default: viewer).");
    }

    if (rolesExists) {
      // Copy the primary role from roles[1] (Postgres arrays are 1-based)
      const { rowCount } = await client.query(
        `UPDATE users SET role = COALESCE(roles[1], 'viewer') WHERE roles IS NOT NULL AND array_length(roles, 1) > 0`
      );
      console.log(`Backfilled role from roles[1] for ${rowCount} user(s).`);

      // Verify no user lost a non-viewer role by mistake
      const { rows: mismatched } = await client.query<{ id: number; name: string; roles: string[]; role: string }>(
        `SELECT id, name, roles, role FROM users WHERE roles IS NOT NULL AND roles[1] IS DISTINCT FROM role`
      );
      if (mismatched.length > 0) {
        console.error("WARNING: Role mismatch detected after backfill:");
        mismatched.forEach((u) =>
          console.error(`  user #${u.id} ${u.name}: roles[1]=${u.roles[0]} but role=${u.role}`)
        );
        throw new Error("Backfill verification failed — aborting before dropping old column.");
      }
      console.log("Backfill verified — all users have correct role.");

      // Drop the old array column
      await client.query(`ALTER TABLE users DROP COLUMN roles`);
      console.log("Dropped users.roles column.");
    }

    console.log("Migration complete.");
  } finally {
    client.release();
  }
}

migrateRolesField()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
