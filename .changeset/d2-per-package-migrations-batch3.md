---
"@voyant-travel/operations": patch
---

D.2 slice 1 (batch 3) — operations now owns and ships its migration history (drizzle.migrations.config.ts, db:generate, generated migrations/ baseline in `files`). Its declared cross-package FK into @voyant-travel/identity (identityAddresses) resolves via the closure (identity applied first). Verified column-for-column against the framework bundle, and the full fresh-D.2 union still applies cleanly. See `docs/architecture/migration-collector-d2.md`.
