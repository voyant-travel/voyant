---
"@voyant-travel/commerce": patch
"@voyant-travel/relationships": patch
---

Settings reference-data creates now return a deterministic 409 conflict on
duplicate unique keys instead of a generic 500, so the admin UI can render an
inline field error. `POST /v1/admin/pricing/price-catalogs` maps a duplicate
`code` to `duplicate_price_catalog_code`, and
`POST /v1/admin/relationships/custom-fields` maps a duplicate `(entityType,
key)` to `duplicate_custom_field_key`. Both use `onConflictDoNothing` and throw
a 409 `ApiHttpError` carrying `details.fields` / `details.issues`, matching the
existing product-type / product-tag duplicate-error shape.
