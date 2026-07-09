# Security Architecture
## MK Digital Operations Center (MK DOC)

**Version:** 1.0

---

## 1. Security Overview

MK DOC is an internal operations tool handling sensitive asset metadata. The security architecture prioritizes:
1. Strong authentication and session management
2. Role-based authorization on all data operations
3. Input validation at every API boundary
4. Defense-in-depth with multiple security layers
5. Audit logging for all mutations
6. Secrets management via environment variables

---

## 2. Authentication

### Session-Based Authentication

MK DOC uses **server-side sessions** via `express-session` backed by PostgreSQL (`connect-pg-simple`).

```
Login Flow:
  1. POST /api/auth/login { email, password }
  2. bcrypt.compare(password, storedHash) — cost factor 12
  3. req.session.userId = user.id
  4. Session persisted to sessions table in PostgreSQL
  5. Set-Cookie: session=<signed_token>; HttpOnly; Secure; SameSite=Lax
```

**Why sessions over JWT:**
- Instant revocation on logout (session deleted from DB)
- No client-side token storage (eliminates XSS token theft risk)
- Server maintains full control of session lifecycle

### Session Security Settings

```typescript
{
  secret: process.env.SESSION_SECRET,  // min 32 random bytes
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,    // not accessible via document.cookie
    secure: true,      // HTTPS only in production
    sameSite: "lax",   // CSRF protection
    maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
  }
}
```

### Password Security
- bcrypt with cost factor 12 (≈250ms per hash on modern hardware)
- No plaintext passwords ever written to logs or database
- Password minimum length enforced by Zod validation

### Rate Limiting
- Login endpoint: **10 requests per 15 minutes per IP**
- Implemented via `express-rate-limit`
- Exceeding limit returns `429 Too Many Requests` with `{ error, code: "TOO_MANY_REQUESTS" }`

---

## 3. Authorization

### Role-Based Access Control (RBAC)

```
Role hierarchy (highest to lowest):
  admin   (4) — full access including user/team management
  editor  (3) — create, update on all assets
  analyst (2) — read all, can view audit logs
  viewer  (1) — read-only access to all assets
```

### Permission Matrix

| Action | viewer | analyst | editor | admin |
|---|---|---|---|---|
| GET (all assets) | ✅ | ✅ | ✅ | ✅ |
| POST (create) | ❌ | ❌ | ✅ | ✅ |
| PATCH (update) | ❌ | ❌ | ✅ | ✅ |
| DELETE | ❌ | ❌ | ❌ | ✅ |
| GET /admin/users | ❌ | ❌ | ❌ | ✅ |
| GET /admin/audit-logs | ❌ | ✅ | ✅ | ✅ |
| POST/PATCH/DELETE /teams | ❌ | ❌ | ❌ | ✅ |
| GET /security/dashboard | ✅ | ✅ | ✅ | ✅ |

### Middleware Implementation

```typescript
// Protects any route — rejects if no valid session
app.use("/api/applications", requireAuth, applicationRouter);

// Additional role check — rejects if rank insufficient
router.delete("/:id", requireRole("admin"), deleteHandler);
```

---

## 4. Transport Security

### HTTPS
- All production traffic over HTTPS (enforced at the platform/proxy layer)
- HTTP requests redirected to HTTPS via Nginx or platform config
- HSTS header enforced by Helmet: `Strict-Transport-Security: max-age=15552000`

### Security Headers (Helmet)
```
Content-Security-Policy: default-src 'self'; ...
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 0 (modern browsers use CSP)
Referrer-Policy: no-referrer-when-downgrade
Permissions-Policy: camera=(), geolocation=(), microphone=()
```

---

## 5. Input Validation

### API Layer
All request bodies are validated with **Zod schemas** generated from the OpenAPI spec before any database operation:

```typescript
const parsed = CreateApplicationBody.safeParse(req.body);
if (!parsed.success) {
  sendError(res, 400, "Invalid request", "VALIDATION_ERROR");
  return;
}
// Only use parsed.data — never req.body directly
const { name, category, ownerId } = parsed.data;
```

### Content-Type Enforcement
All POST/PATCH requests with a body must include `Content-Type: application/json`:
```
Missing or wrong Content-Type → 415 UNSUPPORTED_MEDIA_TYPE
Exception: /api/storage/* allows multipart/form-data
Exception: No-body requests (Content-Length: 0) pass through
```

### Database Layer
All database queries use **Drizzle ORM parameterized builders** — no string concatenation:
```typescript
// Safe — Drizzle generates parameterized queries
await db.select().from(applicationsTable).where(eq(applicationsTable.id, id));

// Never done — raw SQL with interpolation
// await db.execute(`SELECT * FROM applications WHERE id = ${id}`);
```

---

## 6. Object Storage Security

### Upload Flow
```
1. Client requests signed upload URL: POST /api/storage/upload-url
2. Server validates auth + ACL, generates signed URL
3. Client uploads directly to object storage via signed URL
4. Object path stored in application/document record
```

### Download ACL
```typescript
// artifacts/api-server/src/lib/objectAcl.ts
// Private objects: require valid session
// Public objects: served without auth check
```

Objects in `PRIVATE_OBJECT_DIR` require the requestor to be authenticated.

---

## 7. Audit Logging

All CREATE, UPDATE, and DELETE operations are logged to `audit_logs`:

```typescript
await db.insert(auditLogsTable).values({
  userId: req.user!.id,
  action: "DELETE",
  resource: "application",
  resourceId: id,
  details: JSON.stringify({ deletedAt: new Date().toISOString() }),
});
```

The audit log is:
- **Append-only** (no UPDATE or DELETE on audit_logs table)
- **Tamper-evident** (only admin can read; no route to modify)
- **Queryable** by actor, action, resource, and time range

---

## 8. Dependency Security

### Regular Audits
```bash
pnpm audit
pnpm audit --audit-level=high  # CI gate
```

### Dependabot
GitHub Dependabot is configured in `.github/dependabot.yml` to:
- Check npm dependencies weekly
- Auto-create PRs for minor/patch updates
- Alert on security vulnerabilities immediately

### Lockfile
`pnpm-lock.yaml` is committed and `--frozen-lockfile` is used in CI to prevent unexpected dependency changes.

---

## 9. Secrets Management

| Secret | Where Stored | Never In |
|---|---|---|
| `DATABASE_URL` | Environment secrets | Code, logs, git |
| `SESSION_SECRET` | Environment secrets | Code, logs, git |
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | Environment secrets | Code, logs, git |
| All other secrets | Environment secrets | Code, logs, git |

**Rules:**
- No secrets in source code — ever
- No secrets in `console.log` or Pino logs
- `.env` file is in `.gitignore` and never committed
- `.env.example` contains only placeholder values

---

## 10. Known Limitations & Accepted Risks

| Item | Status | Notes |
|---|---|---|
| No MFA | Accepted for MVP | Planned for v1.2 with TOTP or email OTP |
| Session expiry | 7 days rolling | Shortened to 24h possible if required |
| No IP allowlisting | Accepted | Internal tool; network-level protection assumed |
| SAML/OIDC SSO | Roadmap v2.0 | bcrypt auth sufficient for current user count |
| CORS | Origin-restricted in production | Wildcard only in development |

---

## 11. Security Incident Response

1. **Identify:** Review Pino logs + audit_logs table for anomalous activity
2. **Contain:** Invalidate all sessions via `DELETE FROM sessions`
3. **Notify:** Security team and affected stakeholders within 24 hours
4. **Remediate:** Patch, redeploy, rotate secrets
5. **Review:** Post-incident review within 5 business days

**Emergency session invalidation:**
```sql
-- Invalidate ALL active sessions immediately
DELETE FROM sessions;
```

---

## 12. Security Checklist (Pre-Deployment)

- [ ] `SESSION_SECRET` is 32+ random characters (not the example value)
- [ ] `DATABASE_URL` points to a non-public endpoint
- [ ] HTTPS is enforced (not HTTP)
- [ ] `NODE_ENV=production` is set
- [ ] `pnpm audit --audit-level=high` passes with no findings
- [ ] Default admin password has been changed after first login
- [ ] Object storage bucket is not publicly accessible by default
- [ ] Error responses do not expose stack traces (verify `NODE_ENV=production`)
