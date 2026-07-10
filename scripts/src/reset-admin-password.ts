import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const NEW_PASSWORD = process.env.NEW_PASSWORD ?? "Admin@2026!";
const ADMIN_EMAIL  = process.env.ADMIN_EMAIL  ?? "admin@mk.gov";

async function resetAdminPassword() {
  const [user] = await db
    .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.email, ADMIN_EMAIL.toLowerCase()));

  if (!user) {
    console.error(`No user found with email: ${ADMIN_EMAIL}`);
    console.error("Run seed-admin first, or set ADMIN_EMAIL to the correct address.");
    process.exit(1);
  }

  const hash = await bcrypt.hash(NEW_PASSWORD, 12);
  await db
    .update(usersTable)
    .set({ passwordHash: hash, role: "admin", status: "Active" })
    .where(eq(usersTable.id, user.id));

  console.log(`✓ Password reset for: ${user.email} (${user.name})`);
  console.log(`  New password: ${NEW_PASSWORD}`);
  console.log("  IMPORTANT: Change this password after logging in.");
}

resetAdminPassword()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Reset failed:", err);
    process.exit(1);
  });
