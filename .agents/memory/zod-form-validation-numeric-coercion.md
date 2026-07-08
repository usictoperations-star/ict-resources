---
name: Form validation against generated Zod schemas with numeric coercion
description: How to validate React forms against generated OpenAPI Zod Create*Body schemas when form fields are always strings, plus a testing gotcha for type="number" inputs.
---

Generated `Create*Body` Zod schemas (Orval, in `lib/api-zod/src/generated/api.ts`) type
numeric fields as `zod.number()`, but HTML form state holds strings. Don't hand-roll a
parallel validation schema — extend the generated schema per-form:

```ts
const formSchema = CreateInfrastructureBody.extend({
  type: CreateInfrastructureBody.shape.type.min(1, "Type is required"), // generated schema often omits non-empty checks for required selects
  cpuCores: numericStringField(z.coerce.number().int().nonnegative()),  // "" -> undefined, else coerce+validate
});
```

`numericStringField` / `getFieldErrors` shared helpers live in
`artifacts/mk-doc/src/lib/form-validation.ts` — reuse them instead of duplicating regex-based
string validation. After `safeParse`, use `result.data` (already coerced to numbers) to build
the API payload instead of manually calling `Number(form.x)`.

**Why:** keeps client validation in lockstep with the backend contract and removes a class of
hand-rolled regex schemas that drift from the OpenAPI spec.

**Testing gotcha:** `<input type="number">` blocks letter keystrokes at the DOM/browser level,
so an e2e test that types "abc" into a number field will find the field silently stays empty —
this looks like a missed validation error but isn't. Test numeric validation with values the
browser *does* accept but the schema should reject (decimals in int-only fields, negative
numbers), not letters.

**Silent-block gotcha:** when extending a generated `Create*Body` schema, audit *every*
`zod.number().optional()` field in that schema (e.g. shared `teamId` FK), not just the ones you
intentionally added validation for. If the form keeps it as a string (e.g. `""` for
"Unassigned") and it isn't wrapped in `numericStringField`, `safeParse` fails on that field even
though the UI never shows an error for it (no `errors.teamId` rendered) — the submit button just
does nothing with no visible feedback. This bit Infrastructure/Databases/Security forms
simultaneously because all three extended the same generated shape and all forgot `teamId`.
