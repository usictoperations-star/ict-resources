# Product Requirements Document (PRD)
## MK Digital Operations Center (MK DOC)

**Version:** 1.0  
**Date:** July 2025  
**Status:** Active

---

## 1. Project Overview

MK Digital Operations Center (MK DOC) is a centralized internal platform for Mahibere Kidusan's technology department to register, monitor, secure, and manage all digital assets, applications, infrastructure, databases, repositories, releases, and technology operations from a single dashboard.

MK DOC replaces fragmented spreadsheets, disparate monitoring tools, and ad-hoc processes with a unified, role-controlled operations center accessible to all technology teams.

---

## 2. Vision & Objectives

**Vision:** Become the single source of truth for all digital assets and technology operations within the organization.

**Objectives:**
1. Eliminate siloed tracking of applications, servers, and domains across different tools
2. Provide real-time visibility into security posture and system health
3. Enable proactive management of SSL/domain expiry and vulnerability remediation
4. Standardize release management and deployment documentation
5. Enforce accountability through owner and team assignment on every asset
6. Maintain a tamper-evident audit trail of all changes

---

## 3. Business Goals

| Goal | Metric |
|---|---|
| Reduce time-to-find asset information | < 30 seconds to locate any asset |
| Proactive SSL/domain expiry management | Zero unplanned expiries |
| Security posture visibility | 10 KPIs available in real time |
| Complete asset inventory | 100% of production applications registered |
| Audit compliance | Full trail for all CREATE/UPDATE/DELETE operations |

---

## 4. Target Users

- **IT/Technology Department** — primary users managing assets day-to-day
- **Security Team** — vulnerability tracking, security KPI monitoring
- **DevOps/Infrastructure Team** — server, database, and deployment management
- **Management/Executives** — high-level dashboard and reporting

---

## 5. User Personas

### Persona 1: The System Administrator (Admin)
- **Role:** IT Administrator
- **Needs:** Full control over all assets, users, teams, and audit logs
- **Pain Point:** No centralized view of all systems and their ownership
- **Goal:** Maintain an accurate, up-to-date inventory of all digital assets

### Persona 2: The DevOps Engineer (Editor)
- **Role:** Infrastructure / DevOps
- **Needs:** Register servers, manage releases, track repositories
- **Pain Point:** Cannot quickly see which servers host which applications
- **Goal:** Single dashboard to manage infrastructure and deployments

### Persona 3: The Security Analyst (Analyst)
- **Role:** Cybersecurity
- **Needs:** Track vulnerabilities, monitor SSL certs, check security KPIs
- **Pain Point:** Security data is scattered across multiple tools
- **Goal:** Unified security dashboard with actionable KPIs

### Persona 4: The Executive (Viewer)
- **Role:** Technology Director / CTO
- **Needs:** High-level overview of system health, risks, and asset counts
- **Pain Point:** Reports are manual and always out of date
- **Goal:** Real-time executive dashboard with key metrics

---

## 6. Functional Requirements

### 6.1 Authentication & Authorization
- FR-001: Users must log in with email and password
- FR-002: Passwords stored as bcrypt hashes (cost 12)
- FR-003: Sessions maintained server-side with secure cookies
- FR-004: Four roles: `admin`, `editor`, `analyst`, `viewer`
- FR-005: Role-based access control on all data modification endpoints
- FR-006: Login rate limiting (10 attempts per 15 min per IP)
- FR-007: User self-registration disabled by default; admin creates accounts

### 6.2 Executive Dashboard
- FR-010: Display real-time counts for all major asset categories
- FR-011: Show critical alerts (SSL expiring <30 days, domain expiring, failed backups)
- FR-012: Recent activity feed from audit logs
- FR-013: Security KPI summary cards

### 6.3 Application Registry
- FR-020: Full CRUD for applications with 20+ metadata fields
- FR-021: Classification (web, mobile, API, desktop, etc.)
- FR-022: Environment tracking (Production, Staging, Development)
- FR-023: Technology stack fields (frontend, backend, framework, language, database)
- FR-024: Owner (user) and team assignment
- FR-025: Link to infrastructure server and database record
- FR-026: Version tracking and tags
- FR-027: Soft delete with 30-day restore window
- FR-028: CSV export

### 6.4 Infrastructure
- FR-030: Server inventory with type, provider, IP, location, specs (CPU/RAM/disk), OS
- FR-031: Status tracking (active, maintenance, decommissioned)
- FR-032: Owner and team assignment
- FR-033: Notes field for operational context
- FR-034: CSV export

### 6.5 Databases
- FR-040: Database tracking with type (PostgreSQL, MySQL, Redis, etc.)
- FR-041: Server, version, size (GB) tracking
- FR-042: Backup enabled / encryption enabled boolean flags
- FR-043: Status, owner, and team assignment
- FR-044: CSV export

### 6.6 Domains & SSL
- FR-050: Domain registration expiry with countdown (days remaining)
- FR-051: SSL certificate expiry with status (valid/expiring/expired)
- FR-052: Cloudflare-enabled flag
- FR-053: Alert highlighting when expiry < 30 days
- FR-054: "Expiring" quick-filter view
- FR-055: CSV export

### 6.7 Repositories
- FR-060: GitHub repository tracking with URL, default branch, visibility
- FR-061: Open PR and open issue counts
- FR-062: Language, owner, and team assignment
- FR-063: CSV export

### 6.8 Releases
- FR-070: Deployment records with version, environment, status
- FR-071: Status workflow: pending → deployed → rolled_back
- FR-072: Release notes, deployed-by tracking
- FR-073: Link to application record

### 6.9 Security Center
- FR-080: Security Dashboard with 10 real-time KPIs:
  1. Systems in production
  2. Servers missing patches
  3. Applications with critical vulnerabilities
  4. SSL certificates expiring < 30 days
  5. Domains expiring soon
  6. Failed backups
  7. Admin user count
  8. Repos with exposed secrets
  9. Outdated dependencies
  10. Applications not recently scanned
- FR-081: Vulnerability tracking with CVE ID, severity (critical/high/medium/low/info), status
- FR-082: Affected component, version, vendor, category fields on each vulnerability
- FR-083: Vulnerability assignment and resolution tracking
- FR-084: CSV export

### 6.10 Software Inventory
- FR-090: Library/framework tracking with version, vendor, license
- FR-091: Supported / end-of-life / upgrade available flags
- FR-092: EOL date tracking
- FR-093: Link to application
- FR-094: CSV export

### 6.11 Documentation
- FR-100: Document records with title, type (PRD, TRD, SOP, ERD, API, Runbook, Other), URL, notes
- FR-101: Status (draft, review, approved, deprecated)
- FR-102: Link to application

### 6.12 Reports & Analytics
- FR-110: Inventory report (asset counts by category)
- FR-111: Security report (vulnerability counts by severity)

### 6.13 Administration
- FR-120: User CRUD (admin only)
- FR-121: Role assignment
- FR-122: Team CRUD (4 operational teams)
- FR-123: Audit log viewer with actor, action, resource, timestamp

---

## 7. Non-Functional Requirements

| ID | Requirement | Target |
|---|---|---|
| NFR-001 | Page load time (initial) | < 2 seconds on broadband |
| NFR-002 | API response time (P95) | < 500 ms |
| NFR-003 | Uptime | 99.5% monthly |
| NFR-004 | Authentication | All endpoints protected |
| NFR-005 | Data integrity | Foreign key constraints, soft deletes |
| NFR-006 | Auditability | All mutations logged |
| NFR-007 | Browser support | Chrome 120+, Firefox 120+, Safari 17+ |
| NFR-008 | Responsive design | Desktop-first, mobile-accessible |
| NFR-009 | Accessibility | WCAG 2.1 AA baseline |
| NFR-010 | Dark/Light mode | Full theme support |

---

## 8. User Roles & Permissions

| Action | Viewer | Analyst | Editor | Admin |
|---|---|---|---|---|
| View all assets | ✅ | ✅ | ✅ | ✅ |
| Create/Edit assets | ❌ | ❌ | ✅ | ✅ |
| Delete assets | ❌ | ❌ | ❌ | ✅ |
| View audit logs | ❌ | ✅ | ✅ | ✅ |
| Manage users | ❌ | ❌ | ❌ | ✅ |
| Manage teams | ❌ | ❌ | ❌ | ✅ |
| Export data | ✅ | ✅ | ✅ | ✅ |

---

## 9. User Stories

**As an Admin,** I want to register a new application with full metadata so that all teams know what systems exist and who owns them.

**As a DevOps Engineer,** I want to see all SSL certificates expiring within 30 days so that I can renew them before they cause outages.

**As a Security Analyst,** I want to log a new vulnerability with CVE ID and severity so that the team can prioritize remediation.

**As an Executive,** I want to see a real-time security dashboard so that I can assess our current risk posture without asking the security team.

**As an Editor,** I want to record a new release with deployment notes so that there is an auditable history of what was deployed and when.

---

## 10. Acceptance Criteria

- All 12 modules are accessible and functional for users with appropriate roles
- Dashboard KPIs load within 2 seconds on a standard connection
- All CREATE/UPDATE/DELETE operations appear in the audit log within 1 second
- SSL/domain expiry alerts appear correctly for certificates within 30 days
- CSV export works correctly for all list pages
- All forms validate input and display field-level error messages

---

## 11. Success Metrics

| Metric | Target |
|---|---|
| Time to register a new application | < 3 minutes |
| Asset inventory completeness | 100% of production assets registered |
| Security dashboard load time | < 2 seconds |
| SSL expiry incidents (unplanned) | 0 per year |
| Audit log coverage | 100% of mutations |

---

## 12. Future Roadmap

- **v1.1:** Automated SSL/domain expiry email notifications
- **v1.2:** GitHub API integration for live PR/issue counts
- **v1.3:** Vulnerability scanner integration (Trivy, Snyk)
- **v1.4:** Capacity planning view (server resource trending)
- **v2.0:** Multi-organization / multi-tenant support
- **v2.1:** SAML/OIDC SSO integration
- **v2.2:** Mobile app feature parity with web

---

## 13. Assumptions & Constraints

- Users have a stable internet connection for accessing the web application
- The system is internal — not publicly accessible
- PostgreSQL 15+ is available in the deployment environment
- Object storage is provided by Replit Object Storage (S3-compatible)
- Initial deployment is on Replit; future hosting is flexible
- The 4 operational teams are fixed; the system does not need to support arbitrary team hierarchies
