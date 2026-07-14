---
"@voyant-travel/catalog-contracts": patch
"@voyant-travel/catalog": patch
"@voyant-travel/framework": minor
"@voyant-travel/runtime": minor
"@voyant-travel/cruises": patch
"@voyant-travel/commerce": patch
---

Publish the engine-neutral catalog indexer adapter and provider contracts under
`./indexer/contract`, including optional admin lifecycle operations. Add the
framework-neutral `./indexer/conformance` kit for external adapter packages.

Make `deployment.providers.search` authoritative through the `catalog.indexer`
runtime port, ship Typesense as the selected first-party provider, support
explicit project-owned overrides, and remove direct Typesense search and
maintenance bypasses.
