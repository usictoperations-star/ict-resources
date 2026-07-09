---
name: Auth session setup
description: How authentication and sessions are implemented in this project
---

## Pattern

- **bcryptjs** (pure JS, no native build) — installed in `@workspace/api-server`
- **express-session** + **connect-pg-simple** — sessions stored in `sessions` DB table
- Session cookie name: `mk.sid`, httpOnly, 8hr TTL
- `createSessionMiddleware()` in `artifacts/api-server/src/lib/session.ts` — uses `pool` from `@workspace/db` (not a separate pg pool)

## Roles

4 tiers: admin (4) > editor (3) > analyst (2) > viewer (1)
- `can("write")` → editor+
- `can("delete")` → admin only
- `can("admin")` → admin only
- `can("reports")` → analyst+

## Frontend

- `AuthProvider` in `artifacts/mk-doc/src/contexts/auth.tsx`
- Wraps entire app; fetches `/api/auth/me` on mount
- `useAuth()` exposes `user`, `isLoading`, `login()`, `logout()`, `can()`
- Login page shown when `!user && !isLoading`

## DB columns added

- `users.password_hash` (nullable text) — bcrypt hash
- `sessions` table — sid (PK), sess (text), expire (timestamp)

## Seeding passwords

bcryptjs is at `artifacts/api-server/node_modules/bcryptjs` — use:
```
node -e "const b=require('/home/runner/workspace/artifacts/api-server/node_modules/bcryptjs'); console.log(b.hashSync('pass', 12));"
```
Then update DB directly with psql.

**Why:** drizzle-kit push ran, admin users seeded with password Admin@2026! via psql. Other users have no password and must be set by an admin via Administration > Users.
