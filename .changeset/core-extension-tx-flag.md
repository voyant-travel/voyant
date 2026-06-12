---
"@voyantjs/core": patch
---

`Extension` gains an optional `requiresTransactionalDb` flag. Extensions mount under their target module's path prefix, so a transacting extension (e.g. catalog-authoring's compose/duplicate routes under `/v1/admin/products`) must be able to force the transaction-capable db client onto that surface when an app splits db factories per surface.
