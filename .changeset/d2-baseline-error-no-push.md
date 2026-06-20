---
"@voyant-travel/framework-migrations": patch
---

Fix the D.2 import-baseline parity error to stop recommending `drizzle-kit push` (unsafe in production). When a database is behind the cutline, it must reach the cutline schema through its normal migration path, or — if disposable — be dropped and re-created via the FRESH path. The message now also clarifies that import-baseline never alters schema; it only records the cutline for a DB already at it.
