## Description

<!-- Briefly describe what this PR does and why. Link to the issue or task it addresses. -->

Closes # <!-- Issue number, if applicable -->

---

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Refactor (code improvement with no behavior change)
- [ ] Documentation update
- [ ] Dependency update
- [ ] CI/CD change

---

## Changes Made

<!-- List the key changes in bullet points -->

- 
- 

---

## API Changes

- [ ] This PR modifies the OpenAPI spec (`lib/api-spec/openapi.yaml`)
  - [ ] Codegen has been run: `pnpm --filter @workspace/api-spec run codegen`
  - [ ] Generated files are committed (`lib/api-client-react/src/generated/`, `lib/api-zod/src/generated/`)

---

## Database Changes

- [ ] This PR modifies the database schema (`lib/db/src/schema/`)
  - [ ] Schema push has been tested locally: `pnpm --filter @workspace/db run push`
  - [ ] Migration file generated if needed: `pnpm --filter @workspace/db run generate`

---

## Testing

- [ ] TypeScript passes: `pnpm run typecheck`
- [ ] Unit tests pass: `pnpm run test`
- [ ] Manually tested the affected flows in the browser
- [ ] New tests added for new functionality

---

## Checklist

- [ ] My code follows the project's coding standards (see `CONTRIBUTING.md`)
- [ ] I have used `sendError()` for all API error responses
- [ ] I have NOT used `console.log` in server code (use `req.log` or `logger`)
- [ ] All form fields use the correct `ownerId`/`teamId` string-to-number pattern
- [ ] Cache invalidation uses the exact query key (e.g. `["/api/applications"]`)
- [ ] Route ordering is correct (static routes before parameterized routes)
- [ ] Self-review of the diff completed
- [ ] No secrets or credentials in the code

---

## Screenshots (if UI changes)

<!-- Attach before/after screenshots for any UI changes -->
