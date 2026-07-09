# Testing Documentation
## MK Digital Operations Center (MK DOC)

**Version:** 1.0

---

## 1. Testing Strategy Overview

MK DOC uses a multi-layer testing strategy:

| Layer | Tool | Scope |
|---|---|---|
| Type checking | TypeScript | Compile-time correctness |
| Unit tests | Vitest | Pure functions, utilities |
| Integration tests | Vitest + Supertest | API endpoints |
| End-to-end tests | Playwright | Full user flows in browser |
| Security scan | pnpm audit | Dependency vulnerabilities |

---

## 2. Type Checking (CI Gate)

TypeScript strict mode is enforced on every build and CI run:

```bash
# Check all workspace packages
pnpm run typecheck

# Check a specific package
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/mk-doc run typecheck
```

**Rules:**
- `strict: true` in `tsconfig.base.json`
- No `@ts-ignore` without a documented reason
- Explicit return types required on all exported functions

---

## 3. Unit Tests

**Tool:** Vitest  
**Location:** `<package>/src/__tests__/` or `<package>/src/*.test.ts`

### Running Unit Tests
```bash
# All packages
pnpm run test

# Specific package
pnpm --filter @workspace/api-server run test
```

### What to Unit Test
- `sendError()` helper — correct status codes and response shape
- Form validation utilities (`getFieldErrors`, `numericStringField`)
- Date/time calculation utilities (SSL expiry countdown)
- Zod schema validation (valid and invalid inputs)
- Role rank comparisons in `requireRole`

### Example Unit Test
```typescript
// lib/errors.test.ts
import { describe, it, expect, vi } from "vitest";
import { sendError } from "../lib/errors";

describe("sendError", () => {
  it("sends correct status and JSON envelope", () => {
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    sendError(res as any, 404, "Not found", "NOT_FOUND");
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Not found", code: "NOT_FOUND" });
  });

  it("omits code when not provided", () => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    sendError(res as any, 400, "Bad request");
    expect(res.json).toHaveBeenCalledWith({ error: "Bad request" });
  });
});
```

---

## 4. API Integration Tests

**Tool:** Vitest + Supertest  
**Location:** `artifacts/api-server/src/__tests__/`

### Running API Tests
```bash
pnpm --filter @workspace/api-server run test:integration
```

### Test Coverage Targets

#### Authentication
- `POST /api/auth/login` — valid credentials → 200 + session cookie
- `POST /api/auth/login` — wrong password → 401
- `POST /api/auth/login` — missing email → 400
- `POST /api/auth/login` (11th request) → 429 rate limit
- `POST /api/auth/logout` — no body, no Content-Type → 200 (not 415)
- `GET /api/auth/me` — without session → 401

#### Content-Type Enforcement
- `POST /api/applications` with `Content-Type: application/json` → 201
- `POST /api/applications` with `Content-Type: text/plain` → 415
- `POST /api/applications` without Content-Type, with body → 415
- `POST /api/auth/logout` without Content-Type, no body → 200 (exempt)
- `POST /api/storage/upload-url` with `Content-Type: multipart/form-data` → allowed

#### Applications CRUD
- `GET /api/applications` — returns paginated list
- `GET /api/applications?search=portal` — search filter
- `GET /api/applications?status=Active` — status filter
- `POST /api/applications` — creates record, appears in list
- `POST /api/applications` without `name` → 400 validation error
- `PATCH /api/applications/:id` — updates fields
- `DELETE /api/applications/:id` — soft deletes (not in list)
- `POST /api/applications/:id/restore` — restores within 30 days
- Role check: `POST /api/applications` as `viewer` → 403

#### Teams
- `GET /api/teams` — returns 4 default teams
- `POST /api/teams` as admin → 201
- `POST /api/teams` as viewer → 403
- `teamId` FK round-trip: create application with `teamId`, fetch → `teamId` present

#### Error Envelope
- All 4xx/5xx responses contain `{ error: string }` (code optional)
- Auth errors include `code: "UNAUTHENTICATED"` or `"FORBIDDEN"`

### Example API Test
```typescript
import request from "supertest";
import app from "../app";

describe("Content-Type enforcement", () => {
  it("returns 415 for POST with wrong content-type", async () => {
    const res = await request(app)
      .post("/api/applications")
      .set("Content-Type", "text/plain")
      .send("some data")
      .set("Cookie", adminCookie);

    expect(res.status).toBe(415);
    expect(res.body).toMatchObject({
      error: expect.any(String),
      code: "UNSUPPORTED_MEDIA_TYPE",
    });
  });

  it("allows POST without body (no content-length)", async () => {
    const res = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", adminCookie);

    expect(res.status).toBe(200);
  });
});
```

---

## 5. End-to-End Tests

**Tool:** Playwright  
**Location:** `artifacts/mk-doc/e2e/`  
**Browser:** Chromium (headless in CI)

### Running E2E Tests
```bash
# Install Playwright browsers (first time)
pnpm --filter @workspace/mk-doc exec playwright install chromium

# Run all E2E tests
pnpm --filter @workspace/mk-doc run test:e2e

# Run with UI (headed)
pnpm --filter @workspace/mk-doc run test:e2e --headed
```

### Test Scenarios

#### Authentication Flow
```
1. Navigate to /
2. Redirected to /login
3. Enter valid credentials
4. Redirected to dashboard
5. Verify dashboard stats are visible
6. Click logout
7. Redirected to /login
```

#### Application Registry
```
1. Navigate to /applications
2. Verify list renders with pagination
3. Click "Add Application"
4. Fill required fields (name, category, classification, environment, status)
5. Click "Add Application"
6. Verify new row appears in table
7. Click edit icon
8. Modify name
9. Click "Save Changes"
10. Verify updated name in table
11. Click trash icon
12. Confirm deletion
13. Verify row removed from table
```

#### Security Dashboard KPIs
```
1. Navigate to /security
2. Verify 10 KPI cards are rendered
3. Each card shows a numeric value
4. "Last computed" timestamp is visible
```

#### SSL Expiry Alert
```
1. Navigate to /domains
2. Verify domain with SSL expiry < 30 days shows warning badge
3. Navigate to dashboard
4. Verify SSL expiry alert appears in critical alerts section
```

#### Role-Based Access
```
Scenario: Viewer cannot create applications
1. Log in as viewer role user
2. Navigate to /applications
3. "Add Application" button should be absent or disabled
4. Attempt POST /api/applications via fetch → 403
```

---

## 6. Security Testing

### Dependency Audit
```bash
pnpm audit
```
Run in CI. Fails build on `high` or `critical` severity vulnerabilities.

### Manual Security Test Cases

| Test | Expected |
|---|---|
| Login with SQL injection in email | 400 or 401 (parameterized query prevents injection) |
| XSS payload in application name | Stored and rendered as escaped text |
| CSRF: API call without session cookie | 401 |
| Access admin endpoint as viewer | 403 |
| Brute force login (11 attempts) | 429 after 10 |
| POST with no Content-Type + body | 415 |
| Direct access to `/api/storage/objects/private/*` without auth | 401 |

---

## 7. Performance Testing

### Baseline Targets
| Metric | Target |
|---|---|
| Dashboard stats load | < 500ms |
| Application list (20 items) | < 300ms |
| Security KPI dashboard | < 500ms |
| Application create | < 200ms |

### Load Test (Artillery or k6)
```yaml
# Example k6 scenario
import http from 'k6/http';

export default function () {
  const res = http.get('https://mk-doc.example.com/api/applications', {
    headers: { Cookie: 'session=...' },
  });
  check(res, { 'status 200': (r) => r.status === 200 });
}
```

---

## 8. CI Automation

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push and PR:

```
1. pnpm install --frozen-lockfile
2. pnpm run typecheck          (type checking)
3. pnpm run lint               (ESLint)
4. pnpm run test               (unit tests)
5. pnpm run build              (production build — no PORT/BASE_PATH required)
6. pnpm audit --audit-level=high  (security)
```

---

## 9. Test Coverage Requirements

| Layer | Required |
|---|---|
| TypeScript | 100% (compile-time) |
| sendError utility | 100% |
| API auth endpoints | 100% |
| Content-Type middleware | 100% |
| Application CRUD | ≥ 80% |
| All other routes | ≥ 70% |
| E2E happy paths | All 12 modules |

---

## 10. Regression Test Checklist

Run before every release:
- [ ] Login / logout flow works
- [ ] All 12 sidebar modules load without errors
- [ ] Create, edit, delete works on Applications
- [ ] Dashboard stats load correctly
- [ ] Security KPI dashboard shows all 10 KPIs
- [ ] SSL expiry alert appears for expiring domains
- [ ] Pagination works on all list pages
- [ ] CSV export works on all list pages
- [ ] Dark mode toggle works
- [ ] Mobile layout renders without horizontal overflow
- [ ] Audit logs capture all mutations
