---
name: drizzle-kit push in non-interactive shell
description: drizzle-kit push hangs/errors on data-loss confirmation prompts when run from a non-TTY agent shell; use --force to proceed.
---

`pnpm --filter @workspace/db run push` (drizzle-kit push) prompts interactively when a schema change would drop/alter columns with existing data. In an agent shell there is no TTY, so the prompt cannot be answered and the command hangs or errors instead of applying the migration.

**Why:** drizzle-kit's confirmation UI expects a real terminal; agent tool shells are non-interactive.

**How to apply:** when a push involves dropping/renaming columns (e.g. reverting a schema change) and you've already confirmed with the user/task spec that data loss is acceptable, run `drizzle-kit push --config <path> --force` directly instead of the wrapped `pnpm run push` script, e.g. `pnpm --filter @workspace/db exec drizzle-kit push --config ./drizzle.config.ts --force`. Only do this when losing the affected rows is expected/acceptable for the task.
