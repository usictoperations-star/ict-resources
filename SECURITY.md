# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| 1.x (latest) | ✅ Active |
| < 1.0 | ❌ End of life |

---

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Please report security vulnerabilities by emailing:

**security@mahibere-kidusan.org**

Include in your report:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if known)

You will receive an acknowledgment within **48 hours** and a detailed response within **7 days**.

---

## Security Measures

### Authentication
- Session-based authentication with server-side session storage
- Passwords hashed with bcrypt (cost factor 12)
- Login rate limited: 10 attempts per 15-minute window per IP
- Sessions expire and are invalidated on logout

### Authorization
- Role-based access control: `admin`, `editor`, `analyst`, `viewer`
- All API endpoints protected by `requireAuth` middleware
- Sensitive admin operations require `requireRole("admin")`

### Transport
- All production traffic served over HTTPS
- Strict-Transport-Security header enforced via Helmet
- Secure, HttpOnly, SameSite cookies for session tokens

### API
- All JSON POST/PATCH endpoints enforce `Content-Type: application/json`
- Input validated with Zod schemas before any database operation
- Parameterized queries via Drizzle ORM (no raw SQL concatenation)
- Error responses never expose stack traces or internal details

### Dependencies
- Dependencies audited with `pnpm audit` in CI
- Dependabot configured for automated vulnerability alerts
- Production builds use locked `pnpm-lock.yaml`

---

## Responsible Disclosure

We follow responsible disclosure practices. After a fix is deployed:
- We will credit you in the release notes (unless you prefer anonymity)
- We will coordinate disclosure timing with you

Thank you for helping keep MK DOC secure.
