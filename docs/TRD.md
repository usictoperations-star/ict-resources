# Technical Requirements Document (TRD)
## MK Digital Operations Center (MK DOC)

**Version:** 1.0  
**Date:** July 2025

---

## 1. System Architecture Overview

MK DOC is a **monorepo** built with pnpm workspaces. A global reverse proxy routes traffic by path:

```
Client Browser
      │
      ▼
Reverse Proxy (port 80)
      ├── /api/*  →  API Server  (Express 5, port 5000/8080)
      └── /*      →  Web Frontend (Vite, port configured via PORT env)
```

The monorepo is organized into two workspace categories:

- **`artifacts/`** — Deployable applications (API server, web app, mobile app)
- **`lib/`** — Shared libraries consumed by artifacts (DB schema, API spec, generated clients)

---

## 2. Technology Stack

### Runtime & Language
| Component | Technology | Version |
|---|---|---|
| Runtime | Node.js | 24 LTS |
| Language | TypeScript | 5.9 (strict) |
| Package manager | pnpm | 10 (workspaces) |

### Frontend
| Component | Technology | Version |
|---|---|---|
| Framework | React | 19 |
| Build tool | Vite | 6 |
| Routing | Wouter | 3 |
| Data fetching | TanStack Query | 5 |
| Charts | Recharts | 2 |
| Styling | Tailwind CSS | 4 |
| Component library | shadcn/ui | latest |
| Icons | Lucide React | latest |

### Backend
| Component | Technology | Version |
|---|---|---|
| Framework | Express | 5 |
| Session | express-session + connect-pg-simple | latest |
| Logging | Pino + pino-http | latest |
| Security headers | Helmet | latest |
| Rate limiting | express-rate-limit | latest |
| Password hashing | bcryptjs | latest |
| Build | esbuild | latest |

### Database & ORM
| Component | Technology |
|---|---|
| Database | PostgreSQL 15+ |
| ORM | Drizzle ORM |
| Schema push (dev) | drizzle-kit push |
| Migrations (prod) | drizzle-kit migrate |

### API & Validation
| Component | Technology |
|---|---|
| API specification | OpenAPI 3.0 (YAML) |
| Client codegen | Orval |
| Validation | Zod v4 + drizzle-zod |
| Generated hooks | TanStack Query (React Query) |

### Mobile
| Component | Technology |
|---|---|
| Framework | Expo (React Native) |
| Navigation | Expo Router |

---

## 3. Workspace Structure

```
pnpm-workspace.yaml defines:
  packages:
    - "artifacts/*"
    - "lib/*"
    - "scripts"
```

### Libraries (`lib/`)

| Package | Description |
|---|---|
| `@workspace/api-spec` | OpenAPI YAML + Orval codegen config |
| `@workspace/api-client-react` | Generated React Query hooks (do not edit) |
| `@workspace/api-zod` | Generated Zod validation schemas (do not edit) |
| `@workspace/db` | Drizzle schema, migrations, and DB client |
| `@workspace/object-storage-web` | `ObjectUploader` component + `useUpload` hook |

### Artifacts (`artifacts/`)

| Package | Description |
|---|---|
| `@workspace/api-server` | Express 5 API server |
| `@workspace/mk-doc` | React + Vite web frontend |
| `@workspace/mk-doc-mobile` | Expo React Native mobile app |
| `@workspace/mockup-sandbox` | Vite dev server for component previews |

---

## 4. Frontend Architecture

### File Organization
```
artifacts/mk-doc/src/
├── components/          # Shared UI components
│   ├── ui/              # shadcn/ui primitives
│   ├── layout/          # Sidebar, header, nav
│   ├── owner-badge.tsx  # User display
│   ├── team-badge.tsx   # Team display
│   └── ...
├── contexts/
│   └── auth.tsx         # Authentication state
├── lib/
│   ├── form-validation.ts  # Zod-based form helpers
│   └── utils.ts
├── pages/               # One file per route/module
│   ├── dashboard.tsx
│   ├── applications.tsx
│   ├── application-detail.tsx
│   └── ...
└── main.tsx
```

### Data Fetching Pattern
- All API calls use generated hooks from `@workspace/api-client-react`
- No manual `fetch()` calls in page components
- Cache invalidation uses the exact query key from the generated hook: `["/api/<resource>"]`

### State Management
- Server state: TanStack Query (no Redux or Zustand)
- UI state: React `useState` / `useReducer` locally in components
- Auth state: React Context (`useAuth()`)

### Form Pattern
```typescript
const EMPTY_FORM = { name: "", status: "active", ownerId: "", teamId: "" };
const [form, setForm] = useState({ ...EMPTY_FORM });

// On edit: load row into form
setForm({
  name: row.name,
  ownerId: row.ownerId?.toString() ?? "",
  teamId: row.teamId?.toString() ?? "",
});

// On submit: convert back to numbers
const payload = {
  name: form.name,
  ownerId: form.ownerId ? Number(form.ownerId) : null,
  teamId: form.teamId ? Number(form.teamId) : null,
};
```

---

## 5. Backend Architecture

### File Organization
```
artifacts/api-server/src/
├── lib/
│   ├── errors.ts        # sendError() helper
│   ├── logger.ts        # Pino singleton
│   ├── objectAcl.ts     # Storage access control
│   ├── objectStorage.ts # Storage helpers
│   └── session.ts       # Session configuration
├── middlewares/
│   └── requireAuth.ts   # requireAuth, requireRole
├── routes/
│   ├── index.ts         # Router registration
│   ├── applications.ts
│   ├── infrastructure.ts
│   ├── databases.ts
│   ├── domains.ts
│   ├── repositories.ts
│   ├── releases.ts
│   ├── security.ts
│   ├── software.ts
│   ├── documentation.ts
│   ├── reports.ts
│   ├── dashboard.ts
│   ├── admin.ts
│   ├── teams.ts
│   ├── auth.ts
│   ├── storage.ts
│   └── search.ts
└── app.ts               # Express app + middleware stack
```

### Request Lifecycle
```
Request → Helmet → CORS → Pino HTTP → express.json() → Session → Content-Type check
       → requireAuth → requireRole → Route handler → Zod validation → DB query → Response
```

### Error Response Format
All API errors follow the `{ error: string, code?: string }` envelope via `sendError()`:
```typescript
sendError(res, 404, "Not found", "NOT_FOUND");
// → { "error": "Not found", "code": "NOT_FOUND" }
```

### Audit Logging
All route handlers that perform CREATE, UPDATE, or DELETE write to `audit_logs`:
```typescript
await db.insert(auditLogsTable).values({
  userId: req.user!.id,
  action: "CREATE",
  resource: "application",
  resourceId: newApp.id,
  details: JSON.stringify(payload),
});
```

---

## 6. Database Architecture

### Connection
- Drizzle ORM with `node-postgres` (`pg`) driver
- Connection string via `DATABASE_URL` environment variable
- Connection pooling managed by `pg`'s built-in pool

### Schema Conventions
- All tables use `serial` primary keys
- Timestamps: `createdAt` (auto-set), `updatedAt` (auto-set)
- All text-type date fields stored as ISO 8601 strings
- Soft deletes via `deletedAt timestamp` (null = active)
- Foreign keys use `onDelete: "set null"` for ownership fields

### Core Tables
See [Database.md](Database.md) for the full schema.

---

## 7. Authentication & Authorization

### Authentication Flow
1. `POST /api/auth/login` with `{ email, password }`
2. Server verifies password with `bcrypt.compare()`
3. On success: `req.session.userId = user.id`
4. Client receives session cookie (HttpOnly, Secure, SameSite=Lax)
5. Subsequent requests carry the cookie automatically

### Authorization Middleware
```typescript
// Require any authenticated user
router.get("/api/applications", requireAuth, handler);

// Require minimum role
router.delete("/api/applications/:id", requireAuth, requireRole("admin"), handler);
```

### Role Hierarchy
```
admin (4) > editor (3) > analyst (2) > viewer (1)
```

---

## 8. Security Requirements

- All production traffic over HTTPS
- Helmet sets security headers (CSP, HSTS, X-Frame-Options, etc.)
- No raw SQL — all queries via Drizzle ORM parameterized builders
- Input validated with Zod before any DB operation
- Passwords never stored in plaintext — bcrypt hash only
- Session secret from environment variable (never hardcoded)
- Rate limiting on login endpoint
- `Content-Type: application/json` enforced for all JSON POST/PATCH endpoints

---

## 9. Error Handling

### API Errors
All errors use `sendError(res, status, message, code?)`:
```json
{ "error": "Not found", "code": "NOT_FOUND" }
```

### Standard Error Codes
| Code | HTTP Status | Meaning |
|---|---|---|
| `UNAUTHENTICATED` | 401 | No valid session |
| `FORBIDDEN` | 403 | Insufficient role |
| `NOT_FOUND` | 404 | Resource does not exist |
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | Wrong Content-Type |
| `TOO_MANY_REQUESTS` | 429 | Rate limit exceeded |
| `INTERNAL_ERROR` | 500 | Unhandled server error |

### Frontend Errors
- Network errors displayed via toast notifications
- Form validation errors shown inline next to each field
- 401 responses redirect to login page

---

## 10. Logging

- All server logging via **Pino** (structured JSON)
- HTTP request/response logging via **pino-http**
- Log levels: `trace`, `debug`, `info`, `warn`, `error`, `fatal`
- In development: pretty-printed with `pino-pretty`
- In production: JSON to stdout (captured by platform)
- **Rule:** Never use `console.log` in server code — use `req.log` (in handlers) or `logger` (elsewhere)

---

## 11. Performance

- TanStack Query caches API responses in the browser (stale-while-revalidate)
- Dashboard stats computed in real-time (no materialized views for MVP)
- Pagination on all list endpoints (default 20 per page, max 100)
- Database indexes on high-cardinality query fields (status, foreign keys)
- Server bundle built with esbuild for fast cold starts

---

## 12. Configuration Management

All configuration via environment variables — see `.env.example` for the full list.

No configuration is hardcoded in source code. Sensitive values (session secret, DB URL) are provided via environment secrets in the deployment platform.

---

## 13. File Storage

- **Provider:** Replit Object Storage (S3-compatible)
- **Upload flow:** Client requests signed upload URL from `POST /api/storage/upload-url`, then uploads directly to the signed URL
- **Access control:** Private objects require a valid session; public objects served directly
- **Serving:** `GET /api/storage/objects/*` validates ACL before proxying the object

---

## 14. API Versioning

- Current version: unversioned (`/api/<resource>`)
- Future versioning strategy: path-based (`/api/v2/<resource>`) with backward compatibility maintained for one major version

---

## 15. Deployment Architecture

See [Deployment.md](Deployment.md) for full deployment configuration.

**Production:** Replit deployment with auto-provisioned HTTPS, persistent PostgreSQL, and object storage.

**Environment separation:**
- `development` — local development, hot reload
- `production` — built bundle, optimized assets
