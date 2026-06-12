---
"@voyantjs/db": minor
---

`createLinkService(...).list` accepts batched ID filters: `leftIds?: string[]` / `rightIds?: string[]` alongside the existing singular `leftId`/`rightId` (which keep working unchanged). A batched filter resolves with ONE `col = ANY($1)` query instead of one query per ID — on Workers + neon-http that's one subrequest and one roundtrip for N IDs. Details: ids are deduped; a one-element array collapses to the historical `col = $1` equality shape; singular + plural for the same side combine by intersection; an empty array (or an out-of-set singular) short-circuits to `[]` without touching the database; soft-delete filtering and `created_at ASC` ordering are unchanged. Read-only links stay correct: their resolvers only understand singular filters, so batched filters fan out one resolver call per ID (with any second batched side applied locally) — existing read-only resolver implementations need no changes.
