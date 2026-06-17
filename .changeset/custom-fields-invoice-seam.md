---
"@voyant-travel/finance": minor
---

Custom-fields unification (invoice consumption seam). `InvoiceDocumentRuntimeOptions` gains an optional `resolveCustomFields(db, invoice)` hook; when wired, its result is exposed to the invoice template as the `customFields` variable (`{{customFields.<key>}}`). Finance stays decoupled from `relationships` — the deployment provides the resolver where it builds the invoice-generation runtime (it holds the custom-field registry and reads the entity's `custom_fields` column, filtering with `customFieldsVisibleIn(registry, entity, "invoice")`). Completes the reader-consumption trio (export + search are package-side; invoice is deployment-rendered, so finance exposes the hook). See `docs/architecture/custom-fields-unification-adr.md`.
