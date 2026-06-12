---
"@voyantjs/catalog-authoring": patch
---

The catalog-authoring extension declares `requiresTransactionalDb: true` — its compose/duplicate routes run interactive transactions (atomic product-graph clone) and mount under `/v1/admin/products`, so apps that split db factories per surface now serve that surface with the transaction-capable client.
