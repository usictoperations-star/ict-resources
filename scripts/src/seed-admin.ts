import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const ADMIN_EMAIL = "admin@mk.gov";
const ADMIN_PASSWORD = "Admin@2026!";
const ADMIN_NAME = "System Administrator";

async function seedAdmin() {
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, ADMIN_EMAIL));

  if (existing) {
    if (!existing.passwordHash) {
      const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
      await db.update(usersTable).set({
        passwordHash: hash,
        role: "admin",
        status: "Active",
      }).where(eq(usersTable.id, existing.id));
      console.log(`Updated existing user ${ADMIN_EMAIL} with password hash and admin role.`);
    } else {
      console.log(`Admin user ${ADMIN_EMAIL} already exists with a password.`);
    }
    return;
  }

  const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await db.insert(usersTable).values({
    name: ADMIN_NAME,
    email: ADMIN_EMAIL,
    role: "admin",
    status: "Active",
    passwordHash: hash,
  });

  console.log(`Created admin user: ${ADMIN_EMAIL}`);
  console.log(`Password: ${ADMIN_PASSWORD}`);
  console.log("IMPORTANT: Change this password after first login via Administration > Users.");
}

seedAdmin()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
