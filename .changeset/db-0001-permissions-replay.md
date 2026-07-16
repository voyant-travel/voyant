---
"@voyant-travel/db": patch
"@voyant-travel/framework-migrations": patch
---

Make `db/0001_db_baseline`'s `user_profiles.permissions` column replay-safe (`ADD COLUMN IF NOT EXISTS`) and register the rewritten content hash as equivalent: the frozen framework bundle also materialises the column, so adopted managed databases replay the migration against an existing column and fail with 42701.
