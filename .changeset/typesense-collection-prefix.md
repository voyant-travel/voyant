---
"@voyant-travel/catalog": minor
---

The Typesense catalog indexer provider reads an optional `TYPESENSE_COLLECTION_PREFIX` deployment config and namespaces every collection with it, so multi-tenant deployments can share one Typesense cluster with per-tenant key scoping (`<prefix>__.*`).
