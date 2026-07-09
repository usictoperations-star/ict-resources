# Contributing to MK DOC

Thank you for your interest in contributing. This document describes the process for contributing code, documentation, and bug reports.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Branching Strategy](#branching-strategy)
3. [Development Workflow](#development-workflow)
4. [Commit Messages](#commit-messages)
5. [Pull Request Process](#pull-request-process)
6. [Coding Standards](#coding-standards)
7. [API Changes](#api-changes)
8. [Database Changes](#database-changes)
9. [Testing Requirements](#testing-requirements)

---

## Code of Conduct

Be respectful, constructive, and collaborative. Harassment or exclusionary behavior will not be tolerated.

---

## Branching Strategy

We follow **Git Flow**:

| Branch | Purpose |
|---|---|
| `main` | Production-ready, protected — direct pushes not allowed |
| `develop` | Integration branch — all features merge here first |
| `feature/<name>` | New features (branch from `develop`) |
| `release/<version>` | Release stabilization (branch from `develop`) |
| `hotfix/<name>` | Critical production fixes (branch from `main`) |

**Examples:**
```
feature/add-ssl-alerts
feature/team-assignment
hotfix/fix-logout-415
release/1.1.0
```

---

## Development Workflow

```bash
# 1. Fork and clone
git clone https://github.com/your-org/mk-doc.git
cd mk-doc

# 2. Install dependencies
pnpm install

# 3. Set up environment
cp .env.example .env
# Edit .env with your local values

# 4. Push DB schema
pnpm --filter @workspace/db run push

# 5. Create a feature branch from develop
git checkout develop
git pull origin develop
git checkout -b feature/my-feature

# 6. Make your changes
# ... code ...

# 7. Type-check
pnpm run typecheck

# 8. Run tests
pnpm run test

# 9. Push and open a PR against develop
git push origin feature/my-feature
```

---

## Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`

**Examples:**
```
feat(security): add CVE ID field to vulnerability form
fix(domains): correct SSL expiry countdown calculation
docs(api): update pagination examples
chore(deps): bump drizzle-orm to 0.44
```

---

## Pull Request Process

1. Ensure your branch is up to date with `develop`
2. Fill out the pull request template completely
3. All CI checks must pass (typecheck, lint, tests)
4. At least **1 reviewer approval** required for `develop`, **2** for `main`
5. Squash and merge is preferred for feature branches
6. Delete the branch after merging

---

## Coding Standards

### TypeScript
- Strict mode is enforced — no `any` without justification
- Use `zod/v4` for runtime validation
- Prefer `const` over `let`, never `var`

### API Changes
- **Always update the OpenAPI spec first** (`lib/api-spec/openapi.yaml`)
- Run codegen: `pnpm --filter @workspace/api-spec run codegen`
- Use generated Zod schemas in route handlers — do not write manual validators
- Use `sendError(res, status, message, code)` for all error responses
- All error responses must follow `{ error: string, code?: string }` shape

### Frontend
- All data fetching via generated React Query hooks from `@workspace/api-client-react`
- Invalidate queries using the exact query key from the generated hook (e.g. `["/api/applications"]`)
- Form state uses string values for select fields; convert to numbers on submit with `Number(form.field)`
- Owner display: `<OwnerBadge ownerName={row.ownerName} />`
- Team display: `<TeamBadge teamId={row.teamId} />`

### Database
- All schema changes go in `lib/db/src/schema/`
- Run `pnpm --filter @workspace/db run push` for dev, migrations for production
- Never rename the `cloudflarEnabled` field — it is intentional and matches the OpenAPI spec
- All asset tables should include `ownerId` (FK → users) and `teamId` (FK → teams) fields

### Logging
- **Never use `console.log` in server code**
- Use `req.log` in route handlers
- Use the singleton `logger` from `../lib/logger` for non-request code

---

## API Changes

When adding or modifying API endpoints:

1. Edit `lib/api-spec/openapi.yaml`
2. Run `pnpm --filter @workspace/api-spec run codegen`
3. Implement route in `artifacts/api-server/src/routes/<domain>.ts`
4. Use generated Zod schemas: `CreateXBody`, `UpdateXBody`, `XQueryParams`
5. Register in `artifacts/api-server/src/routes/index.ts`
6. Document in `docs/API.md`

> **Route ordering:** Static routes (e.g. `/applications/summary`) must appear BEFORE parameterized routes (`/:id`) in the router.

---

## Database Changes

1. Edit the schema file in `lib/db/src/schema/<domain>.ts`
2. Run `pnpm --filter @workspace/db run push --force` for development
3. Update the OpenAPI spec and regenerate if new fields are exposed
4. Update `docs/Database.md` with schema changes

---

## Testing Requirements

All PRs should include:
- TypeScript passing with `pnpm run typecheck`
- API endpoint tests for new routes
- Frontend component tests for new components
- E2E tests for new user flows

See [docs/Testing.md](docs/Testing.md) for the full testing strategy.
