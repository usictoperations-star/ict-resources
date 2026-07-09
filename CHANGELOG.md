# Changelog

All notable changes to MK Digital Operations Center are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Team assignment (`teamId` FK) on all 7 asset tables (applications, infrastructure, databases, domains, repositories, vulnerabilities, software)
- `TeamSelectField` component in all 7 module create/edit forms
- `TeamBadge` display in 5 asset detail pages (application, infrastructure, database, domain, repository)
- `sendError()` helper for consistent `{ error, code }` error envelope across all API endpoints
- Content-Type enforcement middleware: POST/PATCH with a body must send `application/json`
- Updated OpenAPI `ErrorEnvelope` schema to include optional `code` field

---

## [1.0.0] — 2025-07-01

### Added
- **Executive Dashboard** — live KPIs, system health, alerts, and activity feed
- **Application Registry** — full CRUD with metadata, classification, and owner assignment
- **Infrastructure** — server inventory with specs (CPU, RAM, disk), OS, and status tracking
- **Databases** — PostgreSQL/MySQL/Redis tracking with backup and encryption status
- **Domains & SSL** — registration/SSL expiry monitoring with countdown alerts
- **Repositories** — GitHub repo tracking with PR/issue counts and visibility
- **Releases** — deployment history with version, environment, status, and approval workflow
- **Security Center** — 10-KPI cybersecurity dashboard + vulnerability tracking with CVE IDs, severity scoring (critical/high/medium/low)
- **Software Inventory** — frameworks/libraries with version, vendor, license, EOL, and support status
- **Documentation** — central repository for PRD, TRD, SOP, ERD, and runbooks with type categorization
- **Reports & Analytics** — inventory and security report generation
- **Administration** — user management (admin/editor/analyst/viewer roles), team management (4 fixed teams), full audit log
- **Teams** — 4 fixed operational teams with full CRUD via `/api/teams`
- **Audit Logging** — all CREATE/UPDATE/DELETE mutations write to `audit_logs` automatically
- **Object Storage** — file upload with signed URL generation and ACL-controlled serving
- **Session Authentication** — secure server-side sessions with bcrypt password hashing
- **OpenAPI-first** — contract-first API with Orval codegen generating typed React Query hooks and Zod schemas
- **Owner assignment** — every asset linked to a user via `ownerId` FK with `OwnerBadge` display
- **Soft delete / restore** — applications support 30-day restore window
- **Pagination** — all list endpoints support `page`/`limit` with `total` metadata
- **Export** — CSV export for all list pages
- **Dark/Light mode** — full theme support
- **Responsive design** — desktop-first with mobile-responsive layouts
- **Domain expiry alerts** — SSL and registrar expiry within 30 days highlighted in dashboard
- **Mobile app** — Expo React Native companion app

---

## [0.1.0] — 2025-06-15

### Added
- Initial project scaffolding with pnpm monorepo
- Express 5 API server with pino logging
- React + Vite frontend with Tailwind CSS and shadcn/ui
- PostgreSQL database with Drizzle ORM
- Basic authentication (login/register/logout)
- OpenAPI spec and Orval codegen pipeline
