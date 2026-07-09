# MK Digital Operations Center (MK DOC)

A centralized internal platform to register, monitor, secure, and manage all digital assets, applications, infrastructure, databases, repositories, releases, and technology operations from a single dashboard.

---

## Features

| Module | Description |
|---|---|
| **Executive Dashboard** | Live KPIs, system health, alerts, and activity feed |
| **Application Registry** | Master record for every application with full metadata |
| **Infrastructure** | Servers, VPS, Docker, and container inventory |
| **Databases** | PostgreSQL, MySQL, Redis tracking with backup/encryption status |
| **Domains & SSL** | Expiry monitoring with countdown alerts |
| **Repositories** | GitHub repo tracking with PR/issue counts |
| **Releases** | Deployment history with approval workflow |
| **Security Center** | 10 cybersecurity KPI dashboard + vulnerability tracking |
| **Software Inventory** | Frameworks/libraries with version, vendor, license, and EOL |
| **Documentation** | Central repo for PRD, TRD, SOP, ERD, and runbooks |
| **Reports & Analytics** | Inventory and security reports |
| **Administration** | User management, team management, and audit logs |

---

## Technology Stack

| Layer | Technology |
|---|---|
| **Runtime** | Node.js 24 |
| **Language** | TypeScript 5.9 (strict) |
| **Frontend** | React 19, Vite 6, Wouter, TanStack Query, Recharts |
| **Backend** | Express 5, OpenAPI-first with Orval codegen |
| **Database** | PostgreSQL + Drizzle ORM |
| **Validation** | Zod v4, drizzle-zod |
| **Package Manager** | pnpm 10 (workspaces) |
| **Build** | esbuild (server), Vite (client) |
| **Styling** | Tailwind CSS v4, shadcn/ui |
| **Logging** | Pino |

---

## Repository Structure

```
mk-doc/
├── artifacts/
│   ├── api-server/          # Express API server
│   │   └── src/
│   │       ├── lib/         # Shared helpers (errors, logger, session, object storage)
│   │       ├── middlewares/ # Auth, role enforcement
│   │       └── routes/      # One file per domain module
│   ├── mk-doc/              # React + Vite web frontend
│   │   └── src/
│   │       ├── components/  # Shared UI components
│   │       ├── contexts/    # Auth context
│   │       ├── lib/         # Utilities
│   │       └── pages/       # One file per page/module
│   └── mk-doc-mobile/       # Expo React Native companion app
├── lib/
│   ├── api-spec/            # OpenAPI specification (single source of truth)
│   ├── api-client-react/    # Generated React Query hooks (do not edit)
│   ├── api-zod/             # Generated Zod validation schemas (do not edit)
│   ├── db/                  # Drizzle ORM schema + migrations
│   └── object-storage-web/  # File upload component + hook
├── scripts/                 # Utility scripts
├── docs/                    # All project documentation
│   ├── PRD.md
│   ├── TRD.md
│   ├── Architecture.md
│   ├── API.md
│   ├── Database.md
│   ├── UIUX.md
│   ├── Testing.md
│   ├── Deployment.md
│   └── Security.md
├── .github/
│   ├── workflows/           # CI/CD pipelines
│   ├── ISSUE_TEMPLATE/      # Bug / feature templates
│   └── PULL_REQUEST_TEMPLATE.md
├── pnpm-workspace.yaml      # Workspace catalog + overrides
├── tsconfig.base.json       # Shared TypeScript defaults
├── .env.example             # Environment variables reference
└── README.md
```

---

## Prerequisites

- **Node.js** 24+
- **pnpm** 10+ (`npm install -g pnpm`)
- **PostgreSQL** 15+

---

## Installation

```bash
# Clone the repository
git clone https://github.com/your-org/mk-doc.git
cd mk-doc

# Install all dependencies
pnpm install
```

---

## Environment Setup

```bash
cp .env.example .env
```

Edit `.env` and fill in required values:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Secret for session signing (32+ random chars) |
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | Object storage bucket ID |
| `PRIVATE_OBJECT_DIR` | Private storage directory prefix |
| `PUBLIC_OBJECT_SEARCH_PATHS` | Comma-separated public search paths |

---

## Database Setup

```bash
# Push schema to the database
pnpm --filter @workspace/db run push

# Seed initial data (teams, admin user)
pnpm --filter @workspace/db run seed
```

---

## Local Development

```bash
# Start the API server (port 5000 → proxied at /api)
pnpm --filter @workspace/api-server run dev

# Start the web frontend (proxied at /)
pnpm --filter @workspace/mk-doc run dev

# Start the mobile app (Expo)
pnpm --filter @workspace/mk-doc-mobile run dev
```

---

## Code Generation

Whenever you modify `lib/api-spec/openapi.yaml`, regenerate the typed clients:

```bash
pnpm --filter @workspace/api-spec run codegen
```

This regenerates:
- `lib/api-client-react/src/generated/` — React Query hooks
- `lib/api-zod/src/generated/` — Zod validation schemas

---

## Running Tests

```bash
# Type-check everything
pnpm run typecheck

# Run Playwright end-to-end tests
pnpm --filter @workspace/mk-doc run test:e2e

# Run unit tests
pnpm run test
```

---

## Building for Production

```bash
pnpm run build
```

---

## Deployment

See [docs/Deployment.md](docs/Deployment.md) for full deployment instructions including Replit deployment, Docker, and environment configuration.

---

## API Documentation

The REST API is documented via OpenAPI 3.0 at `lib/api-spec/openapi.yaml`. See [docs/API.md](docs/API.md) for the complete reference.

**Base URL:** `https://<domain>/api`

All endpoints require session authentication except `POST /api/auth/login` and `POST /api/auth/register`.

---

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting pull requests.

**Branch Strategy:**
- `main` — production-ready, protected
- `develop` — integration branch
- `feature/*` — new features
- `release/*` — release preparation
- `hotfix/*` — critical production fixes

---

## Security

To report a security vulnerability, see [SECURITY.md](SECURITY.md).

---

## Documentation

| Document | Description |
|---|---|
| [PRD.md](docs/PRD.md) | Product Requirements Document |
| [TRD.md](docs/TRD.md) | Technical Requirements Document |
| [Architecture.md](docs/Architecture.md) | System architecture |
| [API.md](docs/API.md) | Full API reference |
| [Database.md](docs/Database.md) | Schema, ERD, and data model |
| [UIUX.md](docs/UIUX.md) | Design system and UI guide |
| [Testing.md](docs/Testing.md) | Testing strategy |
| [Deployment.md](docs/Deployment.md) | Deployment guide |
| [Security.md](docs/Security.md) | Security architecture |

---

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE) for details.
