# Deployment Guide
## MK Digital Operations Center (MK DOC)

**Version:** 1.0

---

## 1. Prerequisites

- Node.js 24+
- pnpm 10+
- PostgreSQL 15+
- Object storage (Replit Object Storage or S3-compatible)

---

## 2. Environment Variables

Copy `.env.example` to `.env` and configure all values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `SESSION_SECRET` | ✅ | Minimum 32 random characters |
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | ✅ | Object storage bucket |
| `PRIVATE_OBJECT_DIR` | ✅ | Private storage path prefix |
| `PUBLIC_OBJECT_SEARCH_PATHS` | ✅ | Public path prefixes |
| `PORT` | Set by platform | API server port (default 5000) |
| `NODE_ENV` | Set by platform | `production` for production builds |

Generate a session secret:
```bash
openssl rand -hex 32
```

---

## 3. Replit Deployment (Recommended)

MK DOC is configured for one-click deployment on Replit.

### Step 1: Set Environment Secrets

In Replit > Secrets, add all required environment variables listed above.

### Step 2: Deploy

Click the **Deploy** button in the Replit interface. Replit handles:
- Automatic HTTPS
- PostgreSQL provisioning
- Object storage provisioning
- Reverse proxy setup
- Persistent runtime

### Step 3: Initialize Database

After deployment, run the schema push:
```bash
# Via Replit shell
pnpm --filter @workspace/db run push
pnpm --filter @workspace/db run seed
```

### Artifacts Configuration

Each service is configured in its `artifact.toml`:

**API Server** (`artifacts/api-server/.replit-artifact/artifact.toml`):
```toml
[[services]]
localPort = 8080
name = "API Server"
paths = ["/api"]
```

**Web Frontend** (`artifacts/mk-doc/.replit-artifact/artifact.toml`):
```toml
[[services]]
localPort = 5173
name = "Web"
paths = ["/"]
```

---

## 4. Manual Production Deployment

### Step 1: Install Dependencies
```bash
pnpm install --frozen-lockfile
```

### Step 2: Build All Packages
```bash
# Build shared libs first
pnpm run typecheck:libs

# Build API server
pnpm --filter @workspace/api-server run build
# Output: artifacts/api-server/dist/index.mjs

# Build web frontend
pnpm --filter @workspace/mk-doc run build
# Output: artifacts/mk-doc/dist/
```

### Step 3: Database Setup
```bash
# Apply schema
pnpm --filter @workspace/db run push

# Or run migrations (production-safe)
pnpm --filter @workspace/db run migrate

# Seed initial data
pnpm --filter @workspace/db run seed
```

### Step 4: Start Services
```bash
# API server
NODE_ENV=production PORT=8080 node artifacts/api-server/dist/index.mjs

# Web frontend (serve the built dist/ folder)
# Use any static file server, e.g. nginx or serve
npx serve artifacts/mk-doc/dist -p 3000
```

---

## 5. Docker Deployment

### Dockerfile (API Server)
```dockerfile
FROM node:24-alpine AS builder
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY lib/ ./lib/
COPY artifacts/api-server/ ./artifacts/api-server/
RUN npm install -g pnpm && pnpm install --frozen-lockfile
RUN pnpm --filter @workspace/api-server run build

FROM node:24-alpine
WORKDIR /app
COPY --from=builder /app/artifacts/api-server/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
CMD ["node", "dist/index.mjs"]
```

### Dockerfile (Web Frontend — Nginx)
```dockerfile
FROM node:24-alpine AS builder
WORKDIR /app
COPY . .
RUN npm install -g pnpm && pnpm install --frozen-lockfile
RUN pnpm --filter @workspace/mk-doc run build

FROM nginx:alpine
COPY --from=builder /app/artifacts/mk-doc/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### docker-compose.yml
```yaml
version: "3.9"
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: mk_doc
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  api:
    build:
      context: .
      dockerfile: docker/Dockerfile.api
    environment:
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/mk_doc
      SESSION_SECRET: ${SESSION_SECRET}
      PORT: 8080
      NODE_ENV: production
    ports:
      - "8080:8080"
    depends_on:
      - postgres

  web:
    build:
      context: .
      dockerfile: docker/Dockerfile.web
    ports:
      - "3000:80"

volumes:
  postgres_data:
```

---

## 6. Nginx Configuration

```nginx
# /etc/nginx/conf.d/mk-doc.conf
server {
  listen 80;
  server_name mk-doc.example.com;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  server_name mk-doc.example.com;

  ssl_certificate /etc/letsencrypt/live/mk-doc.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/mk-doc.example.com/privkey.pem;

  # API proxy
  location /api {
    proxy_pass http://localhost:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  # Web frontend (SPA)
  location / {
    root /var/www/mk-doc;
    try_files $uri $uri/ /index.html;
    add_header Cache-Control "no-cache";
  }

  # Static assets (immutable cache)
  location /assets {
    root /var/www/mk-doc;
    add_header Cache-Control "public, max-age=31536000, immutable";
  }
}
```

---

## 7. CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/ci.yml`) automatically:
1. Runs type checking, linting, and tests on every PR
2. Builds all packages on merge to `develop`
3. Deploys to production on merge to `main`

See `.github/workflows/ci.yml` for the full configuration.

---

## 8. Database Migrations (Production)

Never use `drizzle-kit push` in production — it can cause data loss.

**Workflow for production schema changes:**

```bash
# 1. Make schema changes in lib/db/src/schema/
# 2. Generate migration file
pnpm --filter @workspace/db run generate

# 3. Review generated SQL in lib/db/drizzle/
cat lib/db/drizzle/0001_*.sql

# 4. Apply migration (production-safe)
pnpm --filter @workspace/db run migrate

# 5. Commit both the schema change and migration file
```

---

## 9. Rollback Strategy

### Application Rollback
```bash
# Roll back to previous container/deployment
# (Platform-specific — Replit handles this via checkpoint restore)

# Or: git revert and redeploy
git revert HEAD
git push origin main
```

### Database Rollback
```bash
# Drizzle generates down migrations
pnpm --filter @workspace/db run migrate --down
```

---

## 10. Health Check

```bash
curl https://mk-doc.example.com/api/healthz
# → { "status": "ok" }
```

Use this endpoint for load balancer health checks and uptime monitoring.

---

## 11. Monitoring & Alerts

**Recommended setup:**
- **Uptime monitoring:** Uptime Robot or Better Uptime — check `GET /api/healthz` every 5 minutes
- **Error alerting:** Pino logs → centralized logging (Datadog, Logtail, or self-hosted Loki)
- **SSL monitoring:** MK DOC's own Domains module tracks your SSL certs!
- **Database:** PostgreSQL `pg_stat_activity` + `pg_stat_bgwriter` for health metrics

---

## 12. Backup Schedule

| Type | Frequency | Retention |
|---|---|---|
| PostgreSQL full backup | Daily | 30 days |
| PostgreSQL WAL (point-in-time) | Continuous | 7 days |
| Object storage | Versioned | 90 days |
| Application code | Git (all commits) | Forever |

---

## 13. IONOS with Plesk (Non-Profit Hosting)

MK DOC is hosted on IONOS using Plesk as the server control panel. The following tips are specific to this setup.

### Node.js App Setup in Plesk

1. **Create the app in Plesk Node.js extension**
   - Go to **Plesk → Websites & Domains → your domain → Node.js**
   - Set **Application Root** to the repo root (e.g. `/var/www/vhosts/yourdomain.org/httpdocs`)
   - Set **Application Startup File** to `artifacts/api-server/dist/index.js`
   - Set **Node.js version** to 24.x (install via Plesk's Node.js extension if not listed)
   - Set the **Document Root** to the built frontend: `artifacts/mk-doc/dist`

2. **Environment variables**
   - In Plesk → Node.js → **Environment Variables**, add all values from `.env.example`
   - `NODE_ENV=production`
   - `DATABASE_URL=postgresql://user:pass@localhost:5432/mkdoc`
   - `PORT=5000` (Plesk will proxy port 80/443 → 5000)
   - `SESSION_SECRET=<random 64-char hex>`

3. **Static frontend**
   - Run `pnpm run build` locally (or in Plesk's SSH terminal) to produce `artifacts/mk-doc/dist/`
   - In Plesk → **Apache & nginx Settings**, add a location block to serve the static build directly without hitting Node:
     ```nginx
     location / {
         root /var/www/vhosts/yourdomain.org/httpdocs/artifacts/mk-doc/dist;
         try_files $uri $uri/ /index.html;
     }
     location /api/ {
         proxy_pass http://127.0.0.1:5000;
         proxy_set_header Host $host;
         proxy_set_header X-Real-IP $remote_addr;
     }
     ```

### PostgreSQL via Plesk

- IONOS Plesk includes a local PostgreSQL instance managed under **Databases** in the Plesk UI
- Create a database named `mkdoc` and note the credentials for `DATABASE_URL`
- To push the schema from SSH: `pnpm --filter @workspace/db run push --force`
- Enable **daily backups** in Plesk → Backup Manager (IONOS non-profit plans include scheduled backups)

### SSL / HTTPS

- IONOS provides **free Let's Encrypt** certificates through Plesk → SSL/TLS Certificates → Let's Encrypt
- Enable **Force HTTPS redirect** in Plesk → Hosting Settings for the domain
- MK DOC's Domains module will then pick up the expiry date automatically via the `/api/domains` endpoint

### Deploying Updates

```bash
# On your local machine or via Plesk SSH terminal:
git pull origin main
pnpm install --frozen-lockfile
pnpm run build                          # typechecks + builds all packages
pnpm --filter @workspace/db run push --force   # apply any schema changes

# Then in Plesk → Node.js → click "Restart App"
```

> **Tip:** IONOS SSH access is available under **Websites & Domains → SSH Access**. Use the Plesk-managed SSH key or set a password for the subscription user.

### Non-Profit Plan Notes

- IONOS non-profit plans typically cap at 1 or 2 PHP/Node workers per domain — set Plesk Node.js **Workers** to `2` to avoid 502 errors under light load
- If the plan includes a cPanel-migrated stack, switch to the **nginx** web server mode in Plesk → Apache & nginx Settings for better Node.js proxy performance
- Storage quotas apply to object uploads; configure `PRIVATE_OBJECT_DIR` to point within your allowed path (e.g. `/var/www/vhosts/yourdomain.org/private-storage`)
