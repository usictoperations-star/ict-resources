---
name: Orval query hook options typing quirk
description: Generated React Query hooks (Orval) in this repo error on `{ query: { enabled } }` without an explicit queryKey.
---

In this repo's `lib/api-client-react/src/generated/api.ts`, hooks like `useGetApplication`/`useGlobalSearch` accept `options?.query` typed as `UseQueryOptions<...>`. Passing only `{ enabled: boolean }` sometimes fails to typecheck with "Property 'queryKey' is missing", even though the hook internally derives its own default queryKey.

**Why:** Generic inference on the Orval-generated `UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>` doesn't always resolve `TQueryKey` from context when only `enabled` is passed, so TS falls back to requiring `queryKey` explicitly.

**How to apply:** When conditionally enabling a generated query hook, pass an explicit `queryKey` in the options alongside `enabled`, e.g. `{ query: { enabled: !!id, queryKey: ["myKey", id] } }`. Some existing pages (e.g. application-detail, dashboard) still have this unresolved as a pre-existing typecheck error — don't assume it's your own change if you see it elsewhere.
