---
"@voyantjs/crm": patch
"@voyantjs/db": patch
---

Replace the `person_directory_projections` cache table with a Postgres view (closes #446).

The projection table existed to avoid `LATERAL` joins on every people list read, but no current consumer pushes the projection to a search index — it was pure overhead with a rebuild step on every contact-point change. The new `person_directory` view computes the same `(email, phone, website)` triple per person on demand via `LATERAL` lookups against `identity_contact_points`, leaning on the existing `idx_identity_contact_points_entity_kind_primary_created` index.

Net effect:

- `crm.people` list reads now flow through the view; `hydratePeople` returns the same shape it always did.
- The rebuild path is gone — `syncPersonIdentity` no longer calls `rebuildPersonDirectoryProjection`, and the `rebuildPersonDirectoryProjection(s)` exports are removed.
- Stale-cache risk is eliminated: edits to `identity_contact_points` flow through immediately on the next read.

Migration: `templates/operator/migrations/0028_person_directory_view.sql` drops the projection table and creates the view; registered in `meta/_journal.json`.

Out of scope (deferred): if a future Typesense / search pipeline needs materialized snapshots, it can build a `MATERIALIZED VIEW` or its own table from `person_directory` rather than reusing the deprecated projection.
