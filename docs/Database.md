# Database Documentation
## MK Digital Operations Center (MK DOC)

**Database:** PostgreSQL 15+  
**ORM:** Drizzle ORM  
**Schema files:** `lib/db/src/schema/`

---

## 1. Entity Relationship Overview

```
┌──────────┐       ┌───────────────┐
│  teams   │       │    users      │
│──────────│       │───────────────│
│ id  PK   │       │ id  PK        │
│ name     │       │ name          │
│ slug     │       │ email (unique)│
│ description│     │ password_hash │
└────┬─────┘       │ role          │
     │             └──────┬────────┘
     │ teamId FK          │ ownerId / userId FK
     │                    │
     ├────────────────────┼──────────────────────────────────────┐
     │                    │                                       │
     ▼                    ▼                                       ▼
┌────────────────┐  ┌─────────────────┐   ┌─────────────────────────┐
│  applications  │  │  infrastructure │   │  databases              │
│────────────────│  │─────────────────│   │─────────────────────────│
│ id PK          │  │ id PK           │   │ id PK                   │
│ name           │  │ name            │   │ name                    │
│ teamId FK      │  │ teamId FK       │   │ teamId FK               │
│ ownerId FK     │  │ ownerId FK      │   │ ownerId FK              │
│ infrastructureId◄─┘                 │   │ backupEnabled            │
│ databaseId FK──┼─────────────────────►  │ encryptionEnabled        │
│ deletedAt      │                        └─────────────────────────┘
└───────┬────────┘
        │ applicationId FK
        ├──────────────────────────────┬─────────────────────────┐
        │                              │                          │
        ▼                              ▼                          ▼
┌───────────────┐           ┌──────────────────┐      ┌────────────────┐
│  releases     │           │ vulnerabilities   │      │    software    │
│───────────────│           │──────────────────│      │────────────────│
│ id PK         │           │ id PK            │      │ id PK          │
│ applicationId │           │ title            │      │ name           │
│ version       │           │ severity         │      │ teamId FK      │
│ environment   │           │ status           │      │ ownerId FK     │
│ status        │           │ cveId            │      │ supported      │
│ deployedBy    │           │ teamId FK        │      │ endOfLife      │
└───────────────┘           │ ownerId FK       │      └────────────────┘
                            └──────────────────┘

┌────────────┐   ┌──────────────┐   ┌────────────────────┐
│  domains   │   │ repositories │   │   documentation    │
│────────────│   │──────────────│   │────────────────────│
│ id PK      │   │ id PK        │   │ id PK              │
│ name       │   │ name         │   │ title              │
│ sslExpiry  │   │ url          │   │ type               │
│ regExpiry  │   │ teamId FK    │   │ applicationId FK   │
│ teamId FK  │   │ ownerId FK   │   └────────────────────┘
│ ownerId FK │   └──────────────┘
└────────────┘

┌──────────────┐   ┌──────────────────┐
│  audit_logs  │   │    sessions      │
│──────────────│   │──────────────────│
│ id PK        │   │ (managed by      │
│ userId FK    │   │  connect-pg-     │
│ action       │   │  simple)         │
│ resource     │   └──────────────────┘
│ resourceId   │
│ details JSON │
│ createdAt    │
└──────────────┘
```

---

## 2. Table Definitions

### `teams`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | serial | PK | Auto-increment ID |
| `name` | text | NOT NULL | Team display name |
| `slug` | text | NOT NULL, UNIQUE | URL-friendly identifier |
| `description` | text | | Optional description |
| `created_at` | timestamp | NOT NULL, default now() | |
| `updated_at` | timestamp | NOT NULL, default now() | |

### `users`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | serial | PK | |
| `name` | text | NOT NULL | Display name |
| `email` | text | NOT NULL, UNIQUE | Login email |
| `password_hash` | text | NOT NULL | bcrypt hash |
| `role` | text | NOT NULL, default 'viewer' | admin/editor/analyst/viewer |
| `created_at` | timestamp | NOT NULL, default now() | |
| `updated_at` | timestamp | NOT NULL, default now() | |

### `applications`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | serial | PK | |
| `name` | text | NOT NULL | Application name |
| `short_name` | text | | Abbreviation |
| `description` | text | | |
| `category` | text | NOT NULL, default 'web' | |
| `classification` | text | NOT NULL, default 'Web Application' | |
| `environment` | text | NOT NULL, default 'Production' | |
| `status` | text | NOT NULL, default 'Active' | |
| `priority` | text | NOT NULL, default 'Medium' | |
| `criticality` | text | NOT NULL, default 'Medium' | |
| `ministry` | text | | Organizational unit |
| `department` | text | | |
| `business_owner` | text | | Free-text owner name |
| `technical_owner` | text | | |
| `product_owner` | text | | |
| `support_contact` | text | | |
| `frontend` | text | | e.g. React |
| `backend` | text | | e.g. Node.js |
| `framework` | text | | |
| `language` | text | | |
| `database` | text | | DB tech used |
| `server_name` | text | | |
| `infrastructure_id` | integer | FK → infrastructure.id | |
| `database_id` | integer | FK → databases.id | |
| `hosting_provider` | text | | |
| `domain` | text | | Primary URL |
| `current_version` | text | | |
| `launch_date` | text | | ISO date string |
| `tags` | text | | Comma-separated |
| `owner_id` | integer | FK → users.id | |
| `team_id` | integer | FK → teams.id, onDelete: set null | |
| `deleted_at` | timestamp | | Soft delete timestamp |
| `created_at` | timestamp | NOT NULL, default now() | |
| `updated_at` | timestamp | NOT NULL, default now() | |

### `infrastructure`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | serial | PK | |
| `name` | text | NOT NULL | |
| `type` | text | NOT NULL | VPS, Bare Metal, Docker, etc. |
| `provider` | text | | AWS, GCP, DigitalOcean, etc. |
| `status` | text | NOT NULL, default 'active' | |
| `ip_address` | text | | |
| `location` | text | | Data center / region |
| `cpu_cores` | integer | | |
| `ram_gb` | integer | | |
| `disk_gb` | integer | | |
| `os` | text | | Operating system |
| `notes` | text | | |
| `owner_id` | integer | FK → users.id | |
| `team_id` | integer | FK → teams.id, onDelete: set null | |
| `created_at` | timestamp | | |
| `updated_at` | timestamp | | |

### `databases`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | serial | PK | |
| `name` | text | NOT NULL | |
| `type` | text | NOT NULL | PostgreSQL, MySQL, Redis, etc. |
| `version` | text | | |
| `server` | text | | Host/connection info |
| `size_gb` | integer | | Approximate size |
| `owner` | text | | Free-text owner |
| `backup_enabled` | boolean | NOT NULL, default true | |
| `encryption_enabled` | boolean | NOT NULL, default false | |
| `status` | text | NOT NULL, default 'active' | |
| `notes` | text | | |
| `owner_id` | integer | FK → users.id | |
| `team_id` | integer | FK → teams.id, onDelete: set null | |
| `created_at` | timestamp | | |
| `updated_at` | timestamp | | |

### `domains`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | serial | PK | |
| `name` | text | NOT NULL | Domain name |
| `registrar` | text | | Namecheap, GoDaddy, etc. |
| `registration_expiry` | text | | ISO date string |
| `ssl_provider` | text | | Let's Encrypt, DigiCert, etc. |
| `ssl_expiry` | text | | ISO date string |
| `ssl_status` | text | NOT NULL, default 'valid' | valid/expiring/expired |
| `dns_provider` | text | | Cloudflare, Route53, etc. |
| `cloudflar_enabled` | boolean | NOT NULL, default false | **Note: intentional typo — matches OpenAPI spec** |
| `status` | text | NOT NULL, default 'active' | |
| `notes` | text | | |
| `owner_id` | integer | FK → users.id | |
| `team_id` | integer | FK → teams.id, onDelete: set null | |
| `created_at` | timestamp | | |
| `updated_at` | timestamp | | |

### `repositories`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | serial | PK | |
| `name` | text | NOT NULL | |
| `url` | text | | GitHub/GitLab URL |
| `default_branch` | text | default 'main' | |
| `visibility` | text | NOT NULL, default 'private' | public/private |
| `language` | text | | Primary language |
| `open_pull_requests` | integer | default 0 | |
| `open_issues` | integer | default 0 | |
| `status` | text | NOT NULL, default 'active' | |
| `notes` | text | | |
| `owner_id` | integer | FK → users.id | |
| `team_id` | integer | FK → teams.id, onDelete: set null | |
| `created_at` | timestamp | | |
| `updated_at` | timestamp | | |

### `releases`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | serial | PK | |
| `application_id` | integer | FK → applications.id | |
| `version` | text | NOT NULL | Semantic version |
| `environment` | text | NOT NULL, default 'Production' | |
| `status` | text | NOT NULL, default 'pending' | pending/deployed/rolled_back |
| `release_notes` | text | | Markdown supported |
| `deployed_by` | text | | Name of deployer |
| `deployed_at` | text | | ISO timestamp |
| `created_at` | timestamp | | |
| `updated_at` | timestamp | | |

### `vulnerabilities`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | serial | PK | |
| `title` | text | NOT NULL | |
| `description` | text | | |
| `severity` | text | NOT NULL, default 'medium' | critical/high/medium/low/info |
| `status` | text | NOT NULL, default 'open' | open/in_progress/resolved/accepted |
| `application_id` | integer | FK → applications.id | |
| `cve_id` | text | | CVE-YYYY-NNNNN |
| `affected_component` | text | | |
| `version` | text | | Vulnerable version |
| `vendor` | text | | |
| `category` | text | | injection/xss/auth/etc. |
| `discovered_at` | text | | ISO date string |
| `resolved_at` | text | | ISO date string |
| `assigned_to` | text | | Free-text assignee |
| `notes` | text | | |
| `owner_id` | integer | FK → users.id | |
| `team_id` | integer | FK → teams.id, onDelete: set null | |
| `created_at` | timestamp | | |
| `updated_at` | timestamp | | |

### `software`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | serial | PK | |
| `name` | text | NOT NULL | Library/framework name |
| `type` | text | NOT NULL | framework/library/tool/runtime/etc. |
| `installed_version` | text | | |
| `latest_version` | text | | |
| `vendor` | text | | |
| `license` | text | | MIT, Apache-2.0, etc. |
| `supported` | boolean | NOT NULL, default true | |
| `end_of_life` | boolean | NOT NULL, default false | |
| `end_of_life_date` | text | | ISO date string |
| `upgrade_available` | boolean | NOT NULL, default false | |
| `application_id` | integer | FK → applications.id | |
| `notes` | text | | |
| `owner_id` | integer | FK → users.id | |
| `team_id` | integer | FK → teams.id, onDelete: set null | |
| `created_at` | timestamp | | |
| `updated_at` | timestamp | | |

### `documentation`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | serial | PK | |
| `title` | text | NOT NULL | |
| `type` | text | NOT NULL | PRD/TRD/SOP/ERD/API/Runbook/Other |
| `url` | text | | Link to document |
| `status` | text | NOT NULL, default 'draft' | draft/review/approved/deprecated |
| `application_id` | integer | FK → applications.id | |
| `notes` | text | | |
| `created_at` | timestamp | | |
| `updated_at` | timestamp | | |

### `audit_logs`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | serial | PK | |
| `user_id` | integer | FK → users.id | Actor |
| `action` | text | NOT NULL | CREATE/UPDATE/DELETE |
| `resource` | text | NOT NULL | Table/resource name |
| `resource_id` | integer | | Affected record ID |
| `details` | text | | JSON blob of changed fields |
| `created_at` | timestamp | NOT NULL, default now() | |

### `notifications`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | serial | PK | |
| `user_id` | integer | FK → users.id | |
| `title` | text | NOT NULL | |
| `message` | text | NOT NULL | |
| `type` | text | NOT NULL, default 'info' | info/warning/error |
| `read` | boolean | NOT NULL, default false | |
| `created_at` | timestamp | | |

---

## 3. Naming Conventions

- Table names: `snake_case`, plural (e.g. `audit_logs`, `applications`)
- Column names: `snake_case` (e.g. `created_at`, `owner_id`)
- TypeScript: camelCase via Drizzle ORM mapping
- Primary key: always `id` (serial)
- Foreign keys: `<table_name_singular>_id` (e.g. `application_id`, `team_id`)
- Timestamps: `created_at`, `updated_at` on every table
- Soft delete: `deleted_at` nullable timestamp

---

## 4. Indexes

Key indexes created by Drizzle schema:
- `applications.status` — frequent filter in list queries
- `applications.deleted_at` — soft delete filter
- `vulnerabilities.severity` — security dashboard filters
- `vulnerabilities.status` — security dashboard filters
- `audit_logs.user_id` — audit viewer queries
- `audit_logs.resource` + `resource_id` — per-record audit trail
- `teams.slug` — UNIQUE constraint (used as identifier)

---

## 5. Known Quirks

- **`cloudflar_enabled` typo** in the `domains` table — this matches the OpenAPI spec and is intentional. Do not rename without updating both the spec and running codegen.
- **Date fields as `text`** — all date/timestamp fields in asset tables (e.g. `ssl_expiry`, `registration_expiry`, `discovered_at`) are stored as `text` (ISO 8601 strings) for schema flexibility. Only `created_at` / `updated_at` use PostgreSQL `timestamp` type.
- **Soft delete only on `applications`** — other tables use hard delete. The applications table has a `deleted_at` column; queries must filter `IS NULL` to exclude deleted records.

---

## 6. Migration Strategy

**Development:**
```bash
pnpm --filter @workspace/db run push --force
```

**Production:**
1. Run `pnpm --filter @workspace/db run generate` to create a migration file
2. Review the generated SQL in `lib/db/drizzle/`
3. Apply with `pnpm --filter @workspace/db run migrate`

---

## 7. Backup Strategy

- PostgreSQL daily automated backups via Replit managed database
- Point-in-time recovery available for 7 days
- For self-hosted: set up `pg_dump` cron job
```bash
pg_dump $DATABASE_URL | gzip > backup_$(date +%Y%m%d).sql.gz
```

---

## 8. Seed Data

Initial seed creates:
- 4 default teams (Infrastructure & Cloud Operations, Application Engineering, Cybersecurity & Governance, Digital Operations & PMO)
- 1 admin user (credentials from environment variables)

```bash
pnpm --filter @workspace/db run seed
```
