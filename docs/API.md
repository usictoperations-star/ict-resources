# API Documentation
## MK Digital Operations Center (MK DOC)

**Version:** 1.0  
**Base URL:** `https://<domain>/api`  
**OpenAPI Spec:** `lib/api-spec/openapi.yaml`

---

## Overview

The MK DOC REST API is an OpenAPI 3.0-compliant JSON API. All endpoints except authentication require a valid session cookie.

### Content Type
All request bodies must be `Content-Type: application/json`. Requests with a body and a missing or incorrect Content-Type return `415 Unsupported Media Type`.

### Authentication
Session-based. Log in via `POST /api/auth/login` to receive a session cookie. Include the cookie in all subsequent requests (browsers do this automatically).

### Pagination
All list endpoints support:
```
GET /api/applications?page=1&limit=20
```
Response includes:
```json
{
  "data": [...],
  "total": 142,
  "page": 1,
  "limit": 20
}
```

### Filtering & Sorting
Endpoints support `search`, `status`, `sortBy`, `sortOrder` query parameters where documented.

---

## Error Envelope

All error responses follow this shape:
```json
{
  "error": "Human-readable message",
  "code": "MACHINE_READABLE_CODE"
}
```

| Code | HTTP Status |
|---|---|
| `UNAUTHENTICATED` | 401 |
| `FORBIDDEN` | 403 |
| `NOT_FOUND` | 404 |
| `VALIDATION_ERROR` | 400 |
| `UNSUPPORTED_MEDIA_TYPE` | 415 |
| `TOO_MANY_REQUESTS` | 429 |
| `INTERNAL_ERROR` | 500 |

---

## Authentication Endpoints

### Login
```
POST /api/auth/login
```
**Rate limit:** 10 requests per 15 minutes per IP

**Request:**
```json
{
  "email": "admin@example.com",
  "password": "your-password"
}
```
**Response 200:**
```json
{
  "user": {
    "id": 1,
    "name": "Admin User",
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

### Logout
```
POST /api/auth/logout
```
No body required. Destroys the session and clears the cookie.

**Response 200:** `{ "message": "Logged out" }`

### Register
```
POST /api/auth/register
```
Creates a new user account. In production, admin approval may be required.

**Request:**
```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "password": "secure-password"
}
```

### Current User
```
GET /api/auth/me
```
Returns the currently authenticated user.

---

## Dashboard

### Get Dashboard Stats
```
GET /api/dashboard/stats
```
Returns aggregate counts for all asset types and critical alert counts.

**Response 200:**
```json
{
  "applications": 52,
  "infrastructure": 18,
  "databases": 24,
  "domains": 31,
  "repositories": 47,
  "releases": 120,
  "vulnerabilities": 8,
  "software": 65,
  "sslExpiringSoon": 3,
  "domainExpiringSoon": 1
}
```

---

## Applications

### List Applications
```
GET /api/applications?page=1&limit=20&search=portal&status=Active&category=web
```

### Get Application
```
GET /api/applications/:id
```

### Create Application
```
POST /api/applications
```
**Required role:** `editor`

**Key fields:** `name` (required), `category`, `classification`, `environment`, `status`, `ownerId`, `teamId`

### Update Application
```
PATCH /api/applications/:id
```
**Required role:** `editor`

### Delete Application (soft delete)
```
DELETE /api/applications/:id
```
**Required role:** `admin`

### Restore Application
```
POST /api/applications/:id/restore
```
**Required role:** `admin` — restores within 30-day window

### Application Summary
```
GET /api/applications/summary
```
Returns counts grouped by category, environment, and status.

---

## Infrastructure

### List Infrastructure
```
GET /api/infrastructure?page=1&limit=20&search=web-server&status=active&type=VPS
```

### Get Infrastructure Item
```
GET /api/infrastructure/:id
```

### Create Infrastructure
```
POST /api/infrastructure
```
**Required role:** `editor`

**Key fields:** `name` (required), `type` (required), `provider`, `status`, `ipAddress`, `location`, `cpuCores`, `ramGb`, `diskGb`, `os`, `ownerId`, `teamId`

### Update Infrastructure
```
PATCH /api/infrastructure/:id
```

### Delete Infrastructure
```
DELETE /api/infrastructure/:id
```
**Required role:** `admin`

---

## Databases

### List Databases
```
GET /api/databases?page=1&limit=20&type=PostgreSQL
```

### Get Database
```
GET /api/databases/:id
```

### Create Database
```
POST /api/databases
```
**Key fields:** `name` (required), `type` (required), `version`, `server`, `sizeGb`, `backupEnabled`, `encryptionEnabled`, `status`, `ownerId`, `teamId`

### Update / Delete Database
```
PATCH /api/databases/:id
DELETE /api/databases/:id
```

---

## Domains & SSL

### List Domains
```
GET /api/domains?page=1&limit=20&search=example.com
```

### Get Expiring Domains
```
GET /api/domains/expiring
```
Returns domains with SSL or registration expiry within 30 days.

### Create / Update / Delete Domain
```
POST   /api/domains
PATCH  /api/domains/:id
DELETE /api/domains/:id
```

**Key fields:** `name` (required), `registrar`, `registrationExpiry`, `sslProvider`, `sslExpiry`, `sslStatus`, `dnsProvider`, `cloudflarEnabled`, `ownerId`, `teamId`

---

## Repositories

### List / Get / Create / Update / Delete
```
GET    /api/repositories
GET    /api/repositories/:id
POST   /api/repositories
PATCH  /api/repositories/:id
DELETE /api/repositories/:id
```

**Key fields:** `name` (required), `url`, `defaultBranch`, `visibility` (`public`|`private`), `language`, `openPullRequests`, `openIssues`, `ownerId`, `teamId`

---

## Releases

### List / Get / Create / Update / Delete
```
GET    /api/releases
GET    /api/releases/:id
POST   /api/releases
PATCH  /api/releases/:id
DELETE /api/releases/:id
```

**Key fields:** `applicationId`, `version` (required), `environment`, `status` (`pending`|`deployed`|`rolled_back`), `releaseNotes`, `deployedBy`

---

## Security

### Security Dashboard
```
GET /api/security/dashboard
```
Returns all 10 cybersecurity KPIs computed in real time.

**Response 200:**
```json
{
  "systemsInProduction": 52,
  "serversMissingPatches": 3,
  "appsWithCriticalVulns": 2,
  "sslExpiringSoon": 3,
  "domainsExpiringSoon": 1,
  "failedBackups": 1,
  "adminUserCount": 2,
  "reposWithExposedSecrets": 0,
  "outdatedDependencies": 12,
  "appsNotRecentlyScanned": 8,
  "generatedAt": "2025-07-01T10:00:00.000Z"
}
```

### Vulnerabilities
```
GET    /api/security/vulnerabilities?severity=critical&status=open
GET    /api/security/vulnerabilities/:id
POST   /api/security/vulnerabilities
PATCH  /api/security/vulnerabilities/:id
DELETE /api/security/vulnerabilities/:id
```

**Key fields:** `title` (required), `severity` (`critical`|`high`|`medium`|`low`|`info`), `status` (`open`|`in_progress`|`resolved`|`accepted`), `cveId`, `affectedComponent`, `applicationId`, `ownerId`, `teamId`

---

## Software Inventory

```
GET    /api/software?type=framework&supported=true
GET    /api/software/:id
POST   /api/software
PATCH  /api/software/:id
DELETE /api/software/:id
```

**Key fields:** `name` (required), `type` (required), `installedVersion`, `latestVersion`, `vendor`, `license`, `supported`, `endOfLife`, `endOfLifeDate`, `upgradeAvailable`, `applicationId`, `ownerId`, `teamId`

---

## Documentation

```
GET    /api/documentation?type=PRD
GET    /api/documentation/:id
POST   /api/documentation
PATCH  /api/documentation/:id
DELETE /api/documentation/:id
```

**Key fields:** `title` (required), `type` (`PRD`|`TRD`|`SOP`|`ERD`|`API`|`Runbook`|`Other`), `url`, `status`, `applicationId`

---

## Reports

### Inventory Report
```
GET /api/reports/inventory
```

### Security Report
```
GET /api/reports/security
```

---

## Teams

```
GET    /api/teams
GET    /api/teams/:id
POST   /api/teams          (admin only)
PATCH  /api/teams/:id      (admin only)
DELETE /api/teams/:id      (admin only)
```

**Key fields:** `name` (required), `slug` (required, unique), `description`

**Default teams:**
- `Infrastructure & Cloud Operations` (slug: `infra-cloud-ops`)
- `Application Engineering` (slug: `app-engineering`)
- `Cybersecurity & Governance` (slug: `cybersecurity-governance`)
- `Digital Operations & PMO` (slug: `digital-ops-pmo`)

---

## Administration

### Users
```
GET    /api/admin/users           (admin only)
POST   /api/admin/users           (admin only)
PATCH  /api/admin/users/:id       (admin only)
DELETE /api/admin/users/:id       (admin only)
```

### Audit Logs
```
GET /api/admin/audit-logs?page=1&limit=50&action=CREATE&resource=application
```

---

## Storage

### Request Upload URL
```
POST /api/storage/upload-url
Content-Type: application/json

{ "filename": "document.pdf", "contentType": "application/pdf", "visibility": "private" }
```

**Response:**
```json
{
  "uploadUrl": "https://...",
  "objectPath": "/objects/private/uuid/document.pdf"
}
```

### Serve Object
```
GET /api/storage/objects/:path*
```
Returns the object if the requester has access (authenticated for private, public for public).

---

## Global Search

```
GET /api/search?q=payment-gateway
```
Searches across applications, infrastructure, databases, domains, repositories, and software.

---

## Rate Limits

| Endpoint | Limit |
|---|---|
| `POST /api/auth/login` | 10 requests / 15 minutes / IP |
| All other endpoints | No explicit limit (platform-level protection) |

---

## OpenAPI Specification

The machine-readable specification is at `lib/api-spec/openapi.yaml`. You can import it into:
- **Postman:** Import → OpenAPI
- **Insomnia:** Import → From File
- **Swagger UI:** Point to the YAML file
