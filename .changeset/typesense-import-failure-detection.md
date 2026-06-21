---
"@voyant-travel/catalog": minor
---

Surface per-row Typesense bulk-import failures instead of hiding them.

The `documents/import` endpoint returns HTTP 200 even when individual rows fail validation (e.g. a field serialized as an object where the schema expects `string[]`), so a reindex could silently leave a collection empty while the CLI exited 0. The Typesense indexer now inspects the import response.

- `createTypesenseIndexer` parses the import response on both `upsert` and `bulkReindex`. When any row fails, it raises a new `TypesenseImportError` (carrying `collection`/`failed`/`total`/`samples`) by default, so the reindex CLI exits non-zero and event-bus subscribers log the failure.
- New `importFailureMode: "throw" | "best-effort"` option (default `"throw"`) plus an `onImportFailure` reporter and `importErrorSampleSize`. `"best-effort"` logs representative row errors and continues.
- New exported helpers `parseTypesenseImportResults` / `summarizeImportFailures` and types `TypesenseImportRowResult` / `ImportFailureSummary` / `ImportFailureMode`, handling both the fetch client's NDJSON string body and the SDK's parsed results array.

The operator `reindex` CLI gains a `--best-effort` flag and fails non-zero on row import failures by default.
