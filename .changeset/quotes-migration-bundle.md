---
"@voyant-travel/framework-migrations": minor
---

Carry the `person_directory` view into the standard migration bundle and add the new `quotes` columns. The view was dropped at the D.1 collector cutover (only the retired legacy operator baseline created it), so freshly-migrated databases lacked it and CRM person hydration failed; it is now created via `CREATE OR REPLACE VIEW` so existing deployments are unaffected. Also adds `quotes.pax_count` and `quotes.created_by` / `quotes.updated_by`.
