# Architecture Documentation
## MK Digital Operations Center (MK DOC)

**Version:** 1.0  
**Date:** July 2025

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
│                                                                  │
│   ┌──────────────────────┐    ┌──────────────────────────────┐   │
│   │   Web Browser        │    │   Mobile App (Expo)          │   │
│   │   React + Vite       │    │   React Native               │   │
│   └──────────┬───────────┘    └──────────────┬───────────────┘   │
└──────────────┼─────────────────────────────────┼─────────────────┘
               │ HTTPS                           │ HTTPS
               ▼                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Reverse Proxy (port 80)                     │
│              Path-based routing via artifact.toml                │
│                                                                  │
│    /api/*  ──────────────────────────────► API Server            │
│    /*      ──────────────────────────────► Vite SPA              │
└─────────────────────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────┐    ┌──────────────────────────────┐
│    API Server (Express 5)    │    │    Object Storage             │
│    Port: 5000/8080           │◄───│    (Replit / S3-compatible)  │
│    - Authentication          │    └──────────────────────────────┘
│    - Route handlers          │
│    - Audit logging           │
│    - File upload orchestration│
└──────────────┬───────────────┘
               │ Drizzle ORM
               ▼
┌──────────────────────────────┐
│       PostgreSQL 15+         │
│       - 14 domain tables     │
│       - Audit logs           │
│       - Session store        │
└──────────────────────────────┘
```

---

## 2. Monorepo Package Graph

```
pnpm workspace
│
├── lib/api-spec              ← OpenAPI YAML (source of truth)
│       │
│       ├──► lib/api-client-react  (generated React Query hooks)
│       └──► lib/api-zod           (generated Zod schemas)
│
├── lib/db                    ← Drizzle schema + DB client
│       │
│       └──► artifacts/api-server  (runtime DB queries)
│
├── lib/object-storage-web    ← ObjectUploader component
│       │
│       └──► artifacts/mk-doc      (file upload UI)
│
├── artifacts/api-server      ← Express API (leaf — not imported by others)
├── artifacts/mk-doc          ← React web app (leaf)
└── artifacts/mk-doc-mobile   ← Expo mobile app (leaf)
```

### Dependency Rules
- Artifacts (`artifacts/*`) are **leaf packages** — they import from `lib/*` but never from each other
- `lib/*` packages are **composite TypeScript** — they emit declarations consumed by artifacts
- Generated files in `lib/api-client-react/src/generated/` and `lib/api-zod/src/generated/` are never edited by hand

---

## 3. Request Flow

### Authenticated API Request
```
Browser
  │ 1. Request with session cookie
  ▼
Reverse Proxy
  │ 2. Routes /api/* to API server
  ▼
Express App (app.ts)
  │ 3. Helmet (security headers)
  │ 4. Pino HTTP (access log)
  │ 5. express.json() body parser
  │ 6. Session middleware (reads cookie → req.session)
  │ 7. Content-Type check (POST/PATCH with body → must be application/json)
  ▼
Route Handler
  │ 8. requireAuth (validates req.session.userId → loads user from DB)
  │ 9. requireRole (checks ROLE_RANK)
  │ 10. Zod schema validation of req.body
  │ 11. Drizzle ORM query
  │ 12. Audit log write (for mutations)
  │ 13. JSON response
  ▼
Browser
```

### Static Frontend Request
```
Browser
  │ 1. GET /  (or any client-side route)
  ▼
Reverse Proxy
  │ 2. Routes /* to Vite SPA server
  ▼
Vite (dev) / esbuild bundle (prod)
  │ 3. Serves index.html (SPA shell)
  ▼
Browser
  │ 4. React Router (Wouter) renders the correct page component
  │ 5. Page component calls useGetApplications() (generated React Query hook)
  │ 6. Hook fetches GET /api/applications (back through proxy to API server)
```

---

## 4. Contract-First API Design

```
lib/api-spec/openapi.yaml
        │
        │  pnpm --filter @workspace/api-spec run codegen
        ▼
┌──────────────────────────────────────────────────────────────────┐
│  Orval generates two outputs simultaneously:                      │
│                                                                   │
│  lib/api-client-react/src/generated/api.ts                       │
│    - useGetApplications()  → GET /api/applications               │
│    - useCreateApplication() → POST /api/applications             │
│    - useUpdateApplication() → PATCH /api/applications/:id        │
│    - useDeleteApplication() → DELETE /api/applications/:id       │
│                                                                   │
│  lib/api-zod/src/generated/api.ts                                │
│    - CreateApplicationBody  (Zod schema for request validation)  │
│    - UpdateApplicationBody                                        │
│    - ApplicationQueryParams                                       │
└──────────────────────────────────────────────────────────────────┘
        │                               │
        ▼                               ▼
artifacts/mk-doc                  artifacts/api-server
(frontend uses hooks)             (server uses Zod schemas)
```

**Rule:** The OpenAPI spec is written first. Route handlers and frontend hooks are derived from it — never the other way around.

---

## 5. Authentication Architecture

```
POST /api/auth/login
        │
        ▼
  Rate Limiter (10 req / 15 min per IP)
        │
        ▼
  bcrypt.compare(password, hash)
        │
        ▼ success
  req.session.userId = user.id
        │
        ▼
  Session persisted to PostgreSQL (connect-pg-simple)
        │
        ▼
  Set-Cookie: session=<signed token>; HttpOnly; Secure; SameSite=Lax
```

```
GET /api/applications  (subsequent request)
        │
        ▼
  express-session reads cookie → loads session from PostgreSQL
        │
        ▼
  requireAuth: looks up user by req.session.userId
        │
        ▼  found
  req.user = { id, role }
        │
        ▼
  requireRole checks ROLE_RANK[req.user.role] >= required
```

---

## 6. Data Model Overview

```
teams ─────────────────────────────────────────────────────┐
                                                            │
users ──────────────────────────────────────────────────┐  │
                                                         │  │
applications ──────────────────────────── ownerId ──────┘  │
    │                                     teamId ──────────┘
    │
    ├── infrastructureTable (infrastructureId FK)
    ├── databasesTable (databaseId FK)
    ├── repositoriesTable
    ├── releasesTable
    ├── vulnerabilitiesTable (applicationId FK)
    └── softwareTable (applicationId FK)

auditLogsTable ─────── userId FK → users
sessionsTable  ─────── (managed by connect-pg-simple)
notificationsTable ─── userId FK → users
```

---

## 7. Frontend Component Hierarchy

```
App (main.tsx)
└── AuthProvider (contexts/auth.tsx)
    └── Router (Wouter)
        └── Layout (sidebar + header)
            ├── /dashboard         → DashboardPage
            ├── /applications      → ApplicationsPage
            │   └── /applications/:id → ApplicationDetailPage
            ├── /infrastructure    → InfrastructurePage
            │   └── /infrastructure/:id → InfrastructureDetailPage
            ├── /databases         → DatabasesPage
            │   └── /databases/:id → DatabaseDetailPage
            ├── /domains           → DomainsPage
            │   └── /domains/:id  → DomainDetailPage
            ├── /repositories      → RepositoriesPage
            │   └── /repositories/:id → RepositoryDetailPage
            ├── /releases          → ReleasesPage
            ├── /security          → SecurityPage (Dashboard + Vulnerabilities tabs)
            ├── /software          → SoftwarePage
            ├── /documentation     → DocumentationPage
            ├── /reports           → ReportsPage
            └── /admin             → AdminPage (Users + Teams + Audit tabs)
```

---

## 8. Deployment Architecture

```
Replit Platform
│
├── Reverse Proxy (automatic, HTTPS, *.replit.app domain)
│
├── API Server workflow
│   ├── Runs: pnpm --filter @workspace/api-server run dev (dev)
│   └── Runs: node dist/index.mjs (prod, after build)
│
├── Web Frontend workflow
│   ├── Runs: pnpm --filter @workspace/mk-doc run dev (dev)
│   └── Serves: dist/ (prod, after Vite build)
│
├── PostgreSQL (Replit managed database)
│   └── Connection via DATABASE_URL environment secret
│
└── Object Storage (Replit Object Storage)
    └── Access via DEFAULT_OBJECT_STORAGE_BUCKET_ID secret
```

---

## 9. CI/CD Pipeline

See `.github/workflows/ci.yml` for the full pipeline.

```
Push / Pull Request
        │
        ▼
  Install dependencies (pnpm install --frozen-lockfile)
        │
        ▼
  Type-check (pnpm run typecheck)
        │
        ▼
  Lint (eslint)
        │
        ▼
  Build (pnpm run build)
        │
        ▼ (on main branch merge only)
  Deploy to production
```

---

## 10. Key Architectural Decisions

| Decision | Rationale |
|---|---|
| Monorepo with pnpm workspaces | Shared types and generated code without duplication |
| Contract-first OpenAPI | Typed hooks and validators derived from spec; prevents drift |
| Session auth (not JWT) | Simpler revocation; no token refresh complexity for internal tool |
| Drizzle ORM | Type-safe SQL with zero runtime overhead; no query builder abstraction leak |
| esbuild for server bundle | 10× faster than tsc for production builds |
| `text` for date columns | Flexibility for varying date formats; ISO strings normalized at API layer |
| `sendError()` helper | Single place to enforce `{ error, code }` envelope across all routes |
| Soft delete on applications | 30-day restore window prevents accidental permanent deletion |
