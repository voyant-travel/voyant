---
"@voyantjs/db": minor
---

New `@voyantjs/db/aggregate-snapshots` subpath: `readThroughAggregateSnapshot(db, { key, ttlSeconds, compute })` — a read-through TTL cache over the new `aggregate_snapshots` table (`key` text PK, `payload` jsonb, `computed_at`, `stale_after`). Fresh rows (`stale_after > now`) are served without running `compute`; stale/missing rows recompute and upsert in a single `INSERT ... ON CONFLICT (key) DO UPDATE` (neon-http compatible). The cache is strictly best-effort: read or upsert failures fall back to live computation. Two concurrent cold requests may both compute (last write wins — no locking by design). Also exports `aggregateSnapshotKey(...parts)` which joins parts with `:`, stable-stringifies object params (sorted keys), and replaces long parts with an FNV-1a 64 digest.

**BREAKING-ish deploy note: the new `aggregate_snapshots` table requires the upcoming combined migration.** This release deliberately ships NO migration file — the table is exported from `@voyantjs/db/schema` and will be picked up by the next generated migration. Until that migration is applied, `readThroughAggregateSnapshot` degrades gracefully to computing live on every call (the read failure is treated as a cache miss).
