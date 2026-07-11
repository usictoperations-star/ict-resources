# MK DOC — Deployment Handoff

Quick-reference for the sysadmin deploying this app.
Full step-by-step guide (nginx config, systemd service, Plesk setup): **`docs/Deployment.md` → Section 13**.

---

## Server Requirements

| Item       | Requirement                                    |
|------------|------------------------------------------------|
| OS         | Ubuntu 22.04+ or Debian 12+                    |
| Node.js    | **v24** (install via `nvm` or NodeSource)      |
| pnpm       | v10+ (`npm install -g pnpm`)                   |
| PostgreSQL | v15+ (same server or separate DB host)         |
| Proxy      | nginx (config in `docs/Deployment.md`)         |
| SSL        | Certbot / Let's Encrypt or Plesk built-in      |

---

## Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/mkdoc
SESSION_SECRET=<run: openssl rand -hex 32>
NODE_ENV=production
PORT=5000
ALLOWED_ORIGINS=https://yourdomain.com
```

---

## First-Time Setup

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_ORG/mk-doc.git
cd mk-doc

# 2. Install dependencies
pnpm install

# 3. Build everything
pnpm run build

# 4. Create all database tables
pnpm --filter @workspace/db run push --force

# 5. Create the first admin account
pnpm --filter @workspace/scripts run seed-admin

# 6. Start the server
pnpm --filter @workspace/api-server run start
```

---

## First Admin Login

| Field    | Value          |
|----------|----------------|
| URL      | https://yourdomain.com |
| Email    | `admin@mk.gov` |
| Password | `Admin@2026!`  |

> Change this password immediately after first login: **Administration → Users → Edit**

---

## Recovery — If Admin Password Is Forgotten

```bash
# Reset to default password (Admin@2026!)
pnpm --filter @workspace/scripts run reset-admin-password

# Reset to a custom password
NEW_PASSWORD="NewSecurePass!" pnpm --filter @workspace/scripts run reset-admin-password
```

---

## Ongoing Deployments (after first setup)

```bash
git pull origin main
pnpm install
pnpm run build
# Restart the Node process (systemd / PM2 / Plesk Node.js app)
```

---

## Questions for the Sysadmin to Confirm

1. **Domain** — what URL will this run on? (e.g. `mkdoc.company.com`)
2. **Database** — provide the PostgreSQL connection string once created
3. **SSL** — Plesk built-in or Certbot?
4. **Process manager** — PM2 or systemd for keeping Node running?
