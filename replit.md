# MK Digital Operations Center (MK DOC)

A centralized internal platform to register, monitor, secure, and manage all digital assets, applications, infrastructure, databases, repositories, releases, and technology operations from one dashboard.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + wouter routing + Recharts + TanStack Query
- API: Express 5 + OpenAPI-first with Orval codegen
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — single source of truth for all API contracts
- `lib/db/src/schema/` — Drizzle table definitions (one file per domain)
- `artifacts/api-server/src/routes/` — Express route handlers matching the spec
- `artifacts/mk-doc/src/` — React frontend (pages, layout, components)
- `lib/api-client-react/src/generated/` — auto-generated React Query hooks (do not edit)
- `lib/api-zod/src/generated/` — auto-generated Zod validation schemas (do not edit)
- `lib/object-storage-web/` — `ObjectUploader` component + `useUpload` hook for desktop file uploads to object storage
- `artifacts/api-server/src/routes/storage.ts`, `src/lib/objectStorage.ts`, `src/lib/objectAcl.ts` — object storage upload-URL request + serving routes

## Architecture decisions

- Contract-first: OpenAPI spec is written first, then codegen produces typed hooks and Zod validators
- Single Express server handles all 12 modules via path-based routing under `/api`
- Audit logging: all CREATE/UPDATE/DELETE mutations write to `audit_logs` table automatically
- Dashboard stats are computed in real-time from DB queries (no materialized views for MVP)
- `cloudflarEnabled` typo in DB schema — matches the OpenAPI spec, do not rename without running codegen again

## Product

12 modules covering the full operational scope:
1. **Executive Dashboard** — live KPIs, alerts, activity feed
2. **Application Registry** — master record for every application (50+)
3. **Infrastructure** — servers, VPS, Docker, containers
4. **Databases** — PostgreSQL, MySQL, Redis tracking with backup/encryption status
5. **Domains & SSL** — expiry monitoring with countdown alerts
6. **Repositories** — GitHub repo tracking with PR/issue counts
7. **Releases** — deployment history with approval workflow
8. **Security Center** — vulnerability tracking with severity scoring
9. **Software Inventory** — frameworks/libraries with EOL status
10. **Documentation** — central repo for PRD, TRD, SOP, ERD, etc.
11. **Reports & Analytics** — inventory and security reports
12. **Administration** — user management and audit logs

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after any OpenAPI spec change before writing routes
- Grep `lib/api-zod/src/generated/api.ts` for exact Zod schema export names before writing route handlers (Orval naming is `<OperationIdPascal>Body` for body, `<OperationIdPascal>QueryParams` for query)
- Route for `/applications/summary` must come BEFORE `/:id` in the router — Express matches routes in order
- `domains/expiring` route similarly must precede `/:id`
- DB dates stored as `text` for flexibility in the schema; format as ISO strings in API responses
- `queryClient.invalidateQueries({ queryKey: [...] })` calls must exactly match the generated hook's query key (e.g. `getList<X>QueryKey` in `lib/api-client-react/src/generated/api.ts`, usually the literal API path like `/api/documentation`, not a guessed resource name) — a mismatch silently breaks list refresh after create/update/delete

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
