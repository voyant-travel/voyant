---
"@voyant-travel/admin-contracts": patch
"@voyant-travel/quotes": patch
"@voyant-travel/quotes-contracts": minor
"@voyant-travel/relationships": patch
"@voyant-travel/relationships-contracts": minor
"@voyant-travel/storefront": patch
---

Split the legacy `@voyant-travel/crm-contracts` package into
`@voyant-travel/relationships-contracts` and
`@voyant-travel/quotes-contracts`. Runtime packages and public validation
imports now depend on the domain-specific contract packages.
