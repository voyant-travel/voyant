---
"@voyant-travel/catalog": minor
"@voyant-travel/core": patch
"@voyant-travel/framework": patch
"@voyant-travel/inventory": patch
---

Add a provider-agnostic, durable catalog product reindex job that walks canonical inventory
products in bounded pages and rebuilds their projections through the selected indexer runtime.
Product job hosts now pass concrete deployment bindings to fixed job runtimes.
